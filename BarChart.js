// Define the SPARQL endpoint
const sparqlEndpoint = "https://query.wikidata.org/sparql"; // this is the url where we send our query to get data (wikidata is a free knowledge base)

// Function to fetch data from SPARQL endpoint
async function fetchData() {
    // grab the element that shows the 'loading' message on the page
    const loadingMessage = document.getElementById("loading-message");
    // make sure the loading message is visible while we're fetching data
    loadingMessage.classList.remove("hidden");

    // this is the SPARQL query (a language for querying data in linked databases)
    // we are asking wikidata for diseases, their labels, associated risk factors, factor labels, and symptoms
    const sparqlQuery = `
    SELECT ?disease ?diseaseLabel ?factor ?factorLabel ?symptoms ?symptomsLabel
    WHERE {
      // this line filters the results (though it looks like a mistake since ?disease wdt:P5642 wd:Q662860 
      // is repeated and seems to be filtering by an instance of 'risk factor' which might not be the intent)
      // it looks like it's trying to limit the results to diseases that have a specific P5642 property value (which is 'risk factor' for a disease, maybe?)
      ?disease wdt:P5642 wd:Q662860. 
      // this asks for the 'risk factor' (?factor) for each disease
      ?disease wdt:P5642 ?factor . 
      // this asks for the 'symptoms' (?symptoms) for each disease (P780 is the property for 'symptoms')
      ?disease wdt:P780 ?symptoms.
      // this special service tells wikidata to automatically fetch the human-readable names (labels) for our results
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
    }`;

    try {
        // use the fetch api to send the query to the wikidata endpoint
        // we encode the query so it's safe to use in a url
        const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
            // we tell the server we want the results back in a nice json format
            headers: { Accept: "application/json" },
        });

        // if the response status code isn't in the 200s (like 404 or 500), something went wrong
        if (!response.ok) {
            // throw an error so we can catch it later
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        // wait for the response body and parse it as json
        const json = await response.json();
        
        // now, we process the raw json data into a cleaner array of objects
        return json.results.bindings.map((row) => ({
            // we extract the url (value) for the disease, its human-readable name (label), and the factor/factor label
            // we're skipping the 'symptoms' property here because it wasn't mapped into the final object
            disease: row.disease.value,
            diseaseLabel: row.diseaseLabel.value,
            factor: row.factor.value,
            factorLabel: row.factorLabel.value,
        }));
    } catch (error) {
        // if anything went wrong during the fetch or processing, log the error
        console.error("Error fetching data:", error);
        // and return an empty array so the rest of the code doesn't crash
        return [];
    } finally {
        // this block always runs, whether there was an error or not
        // it hides the loading message so the user knows the process is complete (or failed)
        loadingMessage.classList.add("hidden");
    }
}

// Function to prepare data for bar chart
function prepareChartData(data) {
    // we use d3.group to organize the raw data: we group all the entries by their 'factorLabel' (the name of the risk factor)
    const groupedByFactor = d3.group(data, (d) => d.factorLabel);
    
    // now we transform the grouped data into the final format the chart needs: {factor: 'name', count: N}
    return Array.from(groupedByFactor, ([factor, values]) => {
        // inside each factor group, we want to count how many *unique* diseases are associated with it
        // first, we create a set of all disease urls (sets only store unique values)
        const uniqueDiseases = new Set(values.map(v => v.disease));
        return {
            // the risk factor's label
            factor: factor,
            // the number of unique diseases associated with this factor
            count: uniqueDiseases.size
        };
    }).sort((a, b) => b.count - a.count); // finally, we sort the factors so the one with the highest count is first
}

// Function to draw the bar chart
// this function uses the d3.js library to create the bar chart
function drawChart(chartData) {
    // set up the size and spacing (margins) for the chart
    const margin = { top: 20, right: 30, bottom: 150, left: 60 };
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create SVG container
    // select the container element on the page
    const svg = d3
        .select("#barchart-container")
        // add the main svg element for the chart
        .append("svg")
        // set its overall size (including margins)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        // create a group <g> element and shift it to account for the left and top margins
        // all chart elements will be drawn inside this group
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales
    // the x-scale maps the risk factor names (categorical data) to positions on the x-axis
    const x = d3.scaleBand()
        .range([0, width]) // the total width available for the bars
        .domain(chartData.map(d => d.factor)) // use all the factor names as the categories
        .padding(0.2); // add some space between the bars

    // the y-scale maps the disease count (numerical data) to positions on the y-axis
    const y = d3.scaleLinear()
        .range([height, 0]) // the range is inverted (height is the bottom, 0 is the top)
        // the domain starts at 0 and goes up to the highest disease count found in the data
        .domain([0, d3.max(chartData, d => d.count)]);

    // Add bars
    svg.selectAll(".bar")
        // bind the prepared data to the 'bar' elements (which don't exist yet)
        .data(chartData)
        // the 'join' function handles creating new elements and updating/removing old ones
        .join("rect")
        .attr("class", "bar")
        // x position of the bar (based on the factor name)
        .attr("x", d => x(d.factor))
        // y position of the top of the bar (based on the disease count)
        .attr("y", d => y(d.count))
        // width of the bar
        .attr("width", x.bandwidth())
        // height of the bar (calculated from the bottom of the chart to the top of the bar)
        .attr("height", d => height - y(d.count))
        // set the color of the bars
        .attr("fill", "#4CAF50")
        // add a tooltip so when you hover over a bar, you see the exact factor and count
        .append("title")
        .text(d => `${d.factor}: ${d.count} diseases`);

    // Add X axis
    svg.append("g")
        // move the x-axis to the bottom of the chart area
        .attr("transform", `translate(0,${height})`)
        // draw the axis using the x-scale
        .call(d3.axisBottom(x))
        // now, select all the text labels on the x-axis
        .selectAll("text")
        // rotate them by -45 degrees so they don't overlap
        .attr("transform", "rotate(-45)")
        // adjust the text anchor so the rotated labels line up nicely with the ticks
        .style("text-anchor", "end")
        .style("fill", "#333");

    // Add Y axis
    svg.append("g")
        // draw the axis on the left using the y-scale, with 10 ticks
        .call(d3.axisLeft(y).ticks(10))
        // style the y-axis text labels
        .selectAll("text")
        .style("fill", "#333");

    // Add Y axis label (tells us what the numbers mean)
    svg.append("text")
        // rotate it 90 degrees to run vertically
        .attr("transform", "rotate(-90)")
        // position it to the left of the axis
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        // shift it a bit
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "#333")
        .text("Number of Diseases");

    // Add X axis label (tells us what the categories are)
    svg.append("text")
        // position it below the x-axis, centered horizontally
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("fill", "#333")
        .text("Risk Factors");

    // Style axis lines and text (general styling to make it look clean)
    svg.selectAll(".domain, .tick line")
        .style("stroke", "#333");
    
    svg.selectAll(".tick text")
        .style("fill", "#333");
}

// Initialize the visualization
async function init() {
    // first, try to get the raw data from wikidata
    const rawData = await fetchData();
    
    // if we got an empty array back, that means no data was found or the fetch failed
    if (rawData.length === 0) {
        console.warn("No data available to display");
        // update the loading message to reflect that no data is here
        document.getElementById("loading-message").textContent = "No data available";
        // make sure it's visible so the user knows
        document.getElementById("loading-message").classList.remove("hidden");
        return; // stop here, nothing to draw
    }

    // log the raw data to the console for debugging
    console.log("Raw Data:", rawData);
    // process the raw data to get the counts needed for the chart
    const chartData = prepareChartData(rawData);
    // log the final chart data
    console.log("Chart Data:", chartData);
    // draw the bar chart on the screen
    drawChart(chartData);
}

// Start the visualization
// call the init function to kick off the whole process: fetch -> prepare -> draw
init();
