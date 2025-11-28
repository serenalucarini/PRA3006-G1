      // URL endpoint for accessing Wikidata SPARQL queries
        const sparqlEndpoint = "https://query.wikidata.org/sparql";
        
        // stores all the risk factor and disease data fetched from Wikidata
        let allData = [];
        
        // tracks which risk factor is currently selected for display
        let selectedFactor = null;

        /* fetches risk factor and disease data from Wikidata using SPARQL query
           this function queries the Wikidata database to get all diseases related to smoking
           and their associated risk factors */
        async function fetchData() {
            const loadingMessage = document.getElementById("loading-message");
            loadingMessage.textContent = "Loading data...";

            // SPARQL query explanation:
            // ?disease: represents disease entities from Wikidata
            // ?factor: represents risk factors associated with those diseases
            // wdt:P5642 means "classification of related to" - we use this twice
            // wd:Q662860 is the Wikidata ID for "smoking"
            // the first P5642 finds diseases related to smoking
            // the second P5642 finds the risk factors associated with those diseases
            // SERVICE wikibase:label gets human-readable names in the appropriate language
            const sparqlQuery = `
            SELECT ?disease ?diseaseLabel ?factor ?factorLabel
            WHERE {
              ?disease wdt:P5642 wd:Q662860.
              ?disease wdt:P5642 ?factor .
              SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
            }`;

            try {
                // send the SPARQL query to Wikidata API
                const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
                    headers: { Accept: "application/json" },
                });

                // check if the HTTP request was successful
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }

                // parse the JSON response from Wikidata
                const json = await response.json();

                // transform the Wikidata results into a simpler format we can work with
                // each result is a disease-factor pair
                return json.results.bindings.map((row) => ({
                    disease: row.disease.value,           // full Wikidata URI for disease
                    diseaseLabel: row.diseaseLabel.value, // human-readable disease name
                    factor: row.factor.value,             // full Wikidata URI for risk factor
                    factorLabel: row.factorLabel.value,   // human-readable risk factor name
                }));
            } catch (error) {
                // if something goes wrong, log error and show message to user
                console.error("Error fetching data:", error);
                loadingMessage.textContent = "Error loading data. Please try again.";
                return [];
            }
        }

        /* prepares raw data into a format suitable for the bar chart
           groups data by risk factor and counts unique diseases for each factor */
        function prepareChartData(data) {
            // group all data entries by risk factor label using D3's grouping function
            const groupedByFactor = d3.group(data, (d) => d.factorLabel);
            
            // convert grouped data into an array with risk factor name and disease count
            return Array.from(groupedByFactor, ([factor, values]) => {
                // use a Set to count only unique diseases (automatically removes duplicates)
                // Set only stores unique values, so if a disease appears twice, it counts as 1
                const uniqueDiseases = new Set(values.map(v => v.disease));
                return {
                    factor: factor,           // risk factor name
                    count: uniqueDiseases.size // number of unique diseases
                };
            }).sort((a, b) => b.count - a.count); // sort by count, highest first
        }

        /* retrieves all unique diseases associated with a specific risk factor
           returns them as a sorted array */
        function getDiseasesByFactor(factorName) {
            // filter all data to get only entries matching the specified risk factor
            const factorData = allData.filter(d => d.factorLabel === factorName);
            
            // extract disease names and use Set to remove duplicates
            // convert Set back to array using spread operator (...)
            const uniqueDiseases = [...new Set(factorData.map(d => d.diseaseLabel))];
            
            // return diseases sorted alphabetically for better readability
            return uniqueDiseases.sort();
        }

        /* displays the list of diseases in the side panel when a risk factor is clicked */
        function displayDiseases(factorName) {
            // get all diseases associated with this risk factor
            const diseases = getDiseasesByFactor(factorName);
            
            // get references to the panel elements we need to update
            const panel = document.getElementById("diseases-panel");
            const titleEl = document.getElementById("selected-factor");
            const listEl = document.getElementById("diseases-list");

            // calculate disease count for the panel title
            const count = diseases.length;
            
            // update the panel title with factor name and disease count
            // uses proper grammar: "1 disease" vs "2+ diseases"
            titleEl.textContent = `${factorName} (${count} ${count === 1 ? 'disease' : 'diseases'})`;

            // clear any previous diseases from the list
            listEl.innerHTML = "";

            // create a list item for each disease
            diseases.forEach(disease => {
                const li = document.createElement("li");
                li.className = "diseases-item";  // apply the disease-item styling class
                li.textContent = disease;        // set disease name as the text
                listEl.appendChild(li);          // add the item to the list
            });

            // show the panel and update accessibility information
            panel.classList.add("active");             // show panel via CSS class
            panel.setAttribute("aria-hidden", "false"); // announce to screen readers
        }

        /* hides the diseases panel and clears the risk factor selection */
        function hideDiseases() {
            const panel = document.getElementById("diseases-panel");
            panel.classList.remove("active");            // hide panel via CSS class
            panel.setAttribute("aria-hidden", "true");   // hide from screen readers
            selectedFactor = null;                       // clear the selected factor
        }

        /* creates and draws the D3 bar chart showing risk factors and disease counts
           handles bar interactions (click to select, hover effects) */
        function drawChart(chartData) {
            // get the chart container and measure its dimensions
            const container = document.getElementById("barchart-container");
            const availableWidth = container.clientWidth;
            const availableHeight = container.clientHeight;

            // define spacing around the chart for axes and labels
            const margin = {
                top: 20,
                right: 30,
                left: 60,
                bottom: Math.min(250, Math.max(180, Math.floor(availableHeight * 0.25)))
            };

            // calculate the actual chart dimensions after accounting for margins
            const width = availableWidth - margin.left - margin.right;
            const height = availableHeight - margin.top - margin.bottom;

            // remove any previously rendered chart
            container.innerHTML = "";

            // create SVG element for D3 chart and position it correctly
            const svg = d3
                .select("#barchart-container")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${availableWidth} ${availableHeight}`)
                .attr("role", "img")
                .attr("aria-label", "Bar chart showing number of diseases per risk factor")
                .style("display", "block")
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            /* create and configure D3 scales
               scales convert data values into visual positions on the chart */

            // x-axis scale: maps risk factor names to horizontal positions
            // scaleBand creates evenly-spaced positions for each category (factor)
            // padding(0.2) adds 20% space between bars
            const x = d3.scaleBand()
                .range([0, width])
                .domain(chartData.map(d => d.factor))
                .padding(0.2);

            // y-axis scale: maps disease counts to vertical positions
            // range([height, 0]) inverts the scale so 0 is at bottom, max is at top
            // domain([0, max]) sets the scale from 0 to the highest count
            const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(chartData, d => d.count)]);

            /* create bar rectangles and bind data to them */

            // select all bars (none exist yet), join them with data, then create new ones
            svg.selectAll(".bar")
                .data(chartData)
                .join("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.factor))                           // position from left
                .attr("y", d => y(d.count))                            // position from top
                .attr("width", x.bandwidth())                          // bar width (all equal)
                .attr("height", d => Math.max(0, height - y(d.count))) // bar height based on count
                .attr("fill", "#E5E1DA")                               // initial bar color (pink)
                
                // click handler: toggle selection when bar is clicked
                .on("click", function(event, d) {
                    // check if the clicked bar is already selected
                    if (selectedFactor === d.factor) {
                        // if already selected, deselect it by clicking again
                        svg.selectAll(".bar").classed("active", false); // remove highlight
                        hideDiseases();                                  // hide panel
                    } else {
                        // selecting a different bar: first deselect all, then select new one
                        svg.selectAll(".bar").classed("active", false);
                        d3.select(this).classed("active", true);        // highlight new bar
                        selectedFactor = d.factor;                      // update tracking
                        displayDiseases(d.factor);                      // show diseases
                        
                        // smooth scroll the diseases panel into view
                        const panel = document.getElementById("diseases-panel");
                        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                })
                
                // add tooltip text that appears on hover
                .append("title")
                .text(d => `${d.factor}: ${d.count} diseases`);

            /* create and style the axes */

            // create x-axis (bottom axis showing risk factors)
            const xAxis = svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x));

            // rotate x-axis labels 45 degrees for better readability
            xAxis.selectAll("text")
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end")
                .style("fill", "#000000");

            // create y-axis (left axis showing disease counts)
            const yAxis = svg.append("g")
                .call(d3.axisLeft(y).ticks(10)); // show approximately 10 tick marks

            // style y-axis text color
            yAxis.selectAll("text")
                .style("fill", "#000000");

            /* add axis labels */

            // y-axis label (rotated 90 degrees counterclockwise)
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Number of Diseases");

            // x-axis label (positioned below the chart)
            svg.append("text")
                .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Risk Factors");
        }

        /* initialization function - runs when page loads
           fetches data, prepares it, and renders the chart */
        async function init() {
            // fetch all risk factor and disease data from Wikidata
            allData = await fetchData();

            // if no data was retrieved, stop and log warning
            if (allData.length === 0) {
                console.warn("No data available to display");
                return;
            }

            console.log("Raw Data:", allData);

            // process the raw data into a format ready for the chart
            const chartData = prepareChartData(allData);
            console.log("Chart Data:", chartData);

            // if we have processed data, hide loading message and draw the chart
            if (chartData.length > 0) {
                document.getElementById("loading-message").style.display = "none";
                drawChart(chartData);

                // add event listener for window resize to redraw chart responsively
                // this ensures the chart adjusts when the window size changes
                let resizeTimeout;
                window.addEventListener("resize", () => {
                    // debounce: wait 200ms after resize stops before redrawing
                    // this prevents the chart from being redrawn many times during a resize
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        drawChart(chartData);
                    }, 200);
                });
            }
        }

        /* call the initialization function to start the application */
        init();
