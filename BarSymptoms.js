// URL for Wikidata SPARQL queries
        const sparqlEndpoint = "https://query.wikidata.org/sparql";
        
        // stores all the disease and symptom data we fetch
        let allData = [];
        
        // keeps track of which disease bar is selected
        let selectedDisease = null;

        // fetches disease data from Wikidata using SPARQL query
        async function fetchData() {
            const loadingMessage = document.getElementById("loading-message");
            loadingMessage.textContent = "Loading data...";

            // SPARQL query to get smoking-related diseases and their symptoms
            // wdt:P5642 means "related to" and we link it to smoking (wd:Q662860)
            // wdt:P780 means "symptoms"
            // the SERVICE part gets labels in the user's language
            const sparqlQuery = `
            SELECT ?disease ?diseaseLabel ?symptoms ?symptomsLabel
            WHERE {
              ?disease wdt:P5642 wd:Q662860.
              ?disease wdt:P780 ?symptoms.
              SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
            }`;

            try {
                // send the query to Wikidata API
                const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
                    headers: { Accept: "application/json" },
                });

                // check if request worked
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }

                // parse the JSON response
                const json = await response.json();

                // transform the data into a simpler format we can use
                // map through each result and extract the parts we need
                return json.results.bindings.map((row) => ({
                    disease: row.disease.value,
                    diseaseLabel: row.diseaseLabel.value,
                    symptom: row.symptoms.value,
                    symptomLabel: row.symptomsLabel.value,
                }));
            } catch (error) {
                // if something goes wrong, show error message
                console.error("Error fetching data:", error);
                loadingMessage.textContent = "Error loading data. Please try again.";
                return [];
            }
        }

        // takes raw data and organizes it for the chart
        // groups diseases together and counts how many unique symptoms each has
        function prepareChartData(data) {
            // group all the data by disease name using D3
            const groupedByDisease = d3.group(data, (d) => d.diseaseLabel);
            
            // convert the grouped data into an array with disease name and symptom count
            return Array.from(groupedByDisease, ([disease, values]) => {
                // use a Set to count only unique symptoms (no duplicates)
                const uniqueSymptoms = new Set(values.map(v => v.symptomLabel));
                return {
                    disease: disease,
                    count: uniqueSymptoms.size
                };
            }).sort((a, b) => b.count - a.count); // sort by count, biggest first
        }

        // get all symptoms for a specific disease
        // returns them as a sorted array
        function getSymptomsByDisease(diseaseName) {
            // filter to only get data for this disease
            const diseaseData = allData.filter(d => d.diseaseLabel === diseaseName);
            // extract symptom names and remove duplicates using Set
            const uniqueSymptoms = [...new Set(diseaseData.map(d => d.symptomLabel))];
            return uniqueSymptoms.sort(); // sort alphabetically
        }

        // shows symptoms in the side panel when user clicks a disease bar
        function displaySymptoms(diseaseName) {
            // get the symptoms for this disease
            const symptoms = getSymptomsByDisease(diseaseName);
            const panel = document.getElementById("symptoms-panel");
            const titleEl = document.getElementById("selected-disease");
            const listEl = document.getElementById("symptoms-list");

            // update the title with disease name and symptom count
            const count = symptoms.length;
            titleEl.textContent = `${diseaseName} (${count} ${count === 1 ? 'symptom' : 'symptoms'})`;

            // clear out old symptoms from the list
            listEl.innerHTML = "";

            // add each symptom to the list
            symptoms.forEach(symptom => {
                const li = document.createElement("li");
                li.className = "symptoms-item";
                li.textContent = symptom;
                listEl.appendChild(li);
            });

            // show the panel
            panel.classList.add("active");
            panel.setAttribute("aria-hidden", "false");
        }

        // hide the symptoms panel and deselect the disease
        function hideSymptoms() {
            const panel = document.getElementById("symptoms-panel");
            panel.classList.remove("active");
            panel.setAttribute("aria-hidden", "true");
            selectedDisease = null;
        }

        // creates and draws the D3 bar chart
        function drawChart(chartData) {
            const container = document.getElementById("barchart-container");
            const availableWidth = container.clientWidth;
            const availableHeight = container.clientHeight;

            // set up margins for the chart so axes dont overlap content
            const margin = {
                top: 20,
                right: 30,
                left: 60,
                bottom: Math.min(250, Math.max(180, Math.floor(availableHeight * 0.25)))
            };

            // calculate actual chart size after subtracting margins
            const width = availableWidth - margin.left - margin.right;
            const height = availableHeight - margin.top - margin.bottom;

            // delete old chart if it exists
            container.innerHTML = "";

            // create SVG element and add it to the container
            const svg = d3
                .select("#barchart-container")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${availableWidth} ${availableHeight}`)
                .attr("role", "img")
                .attr("aria-label", "Bar chart showing number of symptoms per disease")
                .style("display", "block")
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // create x-axis scale (for diseases - categorical)
            // scaleBand creates evenly spaced positions for each disease name
            // padding(0.2) adds space between bars
            const x = d3.scaleBand()
                .range([0, width])
                .domain(chartData.map(d => d.disease))
                .padding(0.2);

            // create y-axis scale (for symptom counts - linear)
            // goes from 0 at bottom to the max count at top
            const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(chartData, d => d.count)]);

            // create the bars
            svg.selectAll(".bar")
                .data(chartData)
                .join("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.disease))
                .attr("y", d => y(d.count))
                .attr("width", x.bandwidth())
                .attr("height", d => Math.max(0, height - y(d.count)))
                .attr("fill", "#E5E1DA")
                // when you click a bar, either select it or deselect if already selected
                .on("click", function(event, d) {
                    // if this bar is already selected, click again to deselect
                    if (selectedDisease === d.disease) {
                        svg.selectAll(".bar").classed("active", false);
                        hideSymptoms();
                    } else {
                        // deselect all bars, then select the one we clicked
                        svg.selectAll(".bar").classed("active", false);
                        d3.select(this).classed("active", true);
                        selectedDisease = d.disease;
                        displaySymptoms(d.disease);
                        // scroll the symptoms panel into view
                        const panel = document.getElementById("symptoms-panel");
                        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                })
                // show tooltip with disease name and symptom count on hover
                .append("title")
                .text(d => `${d.disease}: ${d.count} symptoms`);

            // create x-axis (bottom)
            const xAxis = svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x));

            // rotate the disease names on x-axis so they dont overlap
            xAxis.selectAll("text")
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end")
                .style("fill", "#000000");

            // create y-axis (left side)
            const yAxis = svg.append("g")
                .call(d3.axisLeft(y).ticks(10));

            yAxis.selectAll("text")
                .style("fill", "#000000");

            // add label for y-axis (rotated text on the left)
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Number of Symptoms");

            // add label for x-axis
            svg.append("text")
                .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Diseases");
        }

        // main function that runs when the page loads
        async function init() {
            // fetch the data from Wikidata
            allData = await fetchData();

            // if no data, stop here
            if (allData.length === 0) {
                console.warn("No data available to display");
                return;
            }

            console.log("Raw Data:", allData);

            // process the data into chart format
            const chartData = prepareChartData(allData);
            console.log("Chart Data:", chartData);

            // if we have data, hide loading message and draw the chart
            if (chartData.length > 0) {
                document.getElementById("loading-message").style.display = "none";
                drawChart(chartData);

                // when the window gets resized, redraw the chart so it fits properly
                let resizeTimeout;
                window.addEventListener("resize", () => {
                    // wait 200ms before redrawing so it doesnt redraw constantly
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        drawChart(chartData);
                    }, 200);
                });
            }
        }

        // run the init function when page loads
        init();
