<script>
        /*
            JavaScript to fetch data from Wikidata SPARQL endpoint, prepare it,
            and draw a D3 bar chart. Everything below is commented to explain steps.
        */

        // SPARQL endpoint to query Wikidata
        const sparqlEndpoint = "https://query.wikidata.org/sparql";

        // Global storage for all fetched rows (so we can query it later)
        let allData = [];

        /**
         * fetchData
         * - Executes a SPARQL query against the endpoint and returns an array of rows.
         * - Each row contains disease, diseaseLabel, factor, factorLabel.
         * - Shows/hides the loading message while running.
         */
        async function fetchData() {
            const loadingMessage = document.getElementById("loading-message");
            // show loading indicator
            loadingMessage.classList.remove("hidden");
            loadingMessage.textContent = "Loading data...";

            // SPARQL query: select disease, factor and symptoms (we only need disease/factor here)
            const sparqlQuery = `
            SELECT ?disease ?diseaseLabel ?factor ?factorLabel ?symptoms ?symptomsLabel
            WHERE {
              ?disease wdt:P5642 wd:Q662860.
              ?disease wdt:P5642 ?factor .
              ?disease wdt:P780 ?symptoms.
              SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
            }`;

            try {
                // Fetch the query result as JSON
                const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
                    headers: { Accept: "application/json" },
                });

                // If the network response is not ok, throw an error to be handled below
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }

                // Parse the returned JSON
                const json = await response.json();

                // Map results into a simpler array of objects for our visualization
                return json.results.bindings.map((row) => ({
                    disease: row.disease.value,
                    diseaseLabel: row.diseaseLabel.value,
                    factor: row.factor.value,
                    factorLabel: row.factorLabel.value,
                }));
            } catch (error) {
                // Log and return an empty array on error
                console.error("Error fetching data:", error);
                return [];
            } finally {
                // hide loading indicator (content will be set by the caller)
                loadingMessage.classList.add("hidden");
            }
        }

        /**
         * prepareChartData
         * - Accepts an array of rows and groups them by factorLabel.
         * - Counts unique diseases per factor (Set based).
         * - Returns an array of { factor, count } sorted descending by count.
         */
        function prepareChartData(data) {
            // Group data by factorLabel using d3.group for convenience
            const groupedByFactor = d3.group(data, (d) => d.factorLabel);
            
            // Convert the grouping to an array and count unique diseases per factor
            return Array.from(groupedByFactor, ([factor, values]) => {
                const uniqueDiseases = new Set(values.map(v => v.disease));
                return {
                    factor: factor,
                    count: uniqueDiseases.size
                };
            }).sort((a, b) => b.count - a.count); // Sort by descending count for presentation
        }

        /**
         * getDiseasesByFactor
         * - Returns a sorted list of unique disease labels associated with a given factor name.
         */
        function getDiseasesByFactor(factorName) {
            const factorData = allData.filter(d => d.factorLabel === factorName);
            const uniqueDiseases = [...new Set(factorData.map(d => d.diseaseLabel))];
            return uniqueDiseases.sort();
        }

        /**
         * displayDiseases
         * - Populates the right-hand panel with the diseases linked to a factor.
         * - Includes the count in the panel title and handles pluralization.
         */
        function displayDiseases(factorName) {
            const diseases = getDiseasesByFactor(factorName);
            const panel = document.getElementById("diseases-panel");
            const titleEl = document.getElementById("selected-factor");
            const listEl = document.getElementById("diseases-list");

            const count = diseases.length;
            // Show factor name and the number of linked diseases (proper pluralization)
            titleEl.textContent = `${factorName} (${count} ${count === 1 ? 'disease' : 'diseases'})`;

            // Clear previous list
            listEl.innerHTML = "";

            // Add each disease as a list item
            diseases.forEach(disease => {
                const li = document.createElement("li");
                li.className = "disease-item";
                li.textContent = disease;
                listEl.appendChild(li);
            });

            // Reveal the panel
            panel.classList.add("active");
            panel.setAttribute("aria-hidden", "false");
        }

        /**
         * drawChart
         * - Draws the bar chart inside #barchart-container with D3.
         * - IMPORTANT: Computes sizes from the container so that the x-axis labels
         *   are always drawn inside the visible .body area (avoids being cut by footer).
         */
        function drawChart(chartData) {
            // Get the container element for measurements
            const container = document.getElementById("barchart-container");

            // Determine available width/height from the container (fallback to defaults)
            // Using clientWidth/clientHeight ensures we measure the actual space inside the .body
            const availableWidth = container.clientWidth || 1000;
            const availableHeight = container.clientHeight || Math.max(600, window.innerHeight * 0.6);

            // Margins: allow extra bottom margin to accomodate rotated labels.
            // Compute bottom margin relative to the availableHeight but clamp it so it never exceeds the container.
            const margin = {
                top: 20,
                right: 30,
                left: 60,
                // Use 18-25% of the container height for bottom margin, clamped to sensible pixel values.
                bottom: Math.min(220, Math.max(100, Math.floor(availableHeight * 0.20)))
            };

            // Compute inner width/height for the chart area (where bars render)
            const width = availableWidth - margin.left - margin.right;
            const height = availableHeight - margin.top - margin.bottom;

            // Clear any existing SVG (useful when re-drawing)
            container.innerHTML = "";

            // Create the SVG sized to the available container height so axes stay inside the scrolling region
            const svg = d3
                .select("#barchart-container")
                .append("svg")
                .attr("width", availableWidth)
                .attr("height", availableHeight)
                .attr("role", "img")
                .attr("aria-label", "Bar chart showing number of diseases per risk factor")
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // X scale: factor names (categorical)
            const x = d3.scaleBand()
                .range([0, width])
                .domain(chartData.map(d => d.factor))
                .padding(0.2);

            // Y scale: linear count scale from 0 to max count
            const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(chartData, d => d.count)]);

            // Add bars
            svg.selectAll(".bar")
                .data(chartData)
                .join("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.factor))
                .attr("y", d => y(d.count))
                .attr("width", x.bandwidth())
                .attr("height", d => Math.max(0, height - y(d.count))) // height must be non-negative
                .attr("fill", "#FF69B4")
                .on("click", function(event, d) {
                    // On click: clear active class from all bars, set on clicked bar
                    svg.selectAll(".bar").classed("active", false);
                    d3.select(this).classed("active", true);

                    // Display the associated diseases in the right panel
                    displayDiseases(d.factor);

                    // Scroll the panel into view if it's not fully visible (helpful on small screens)
                    const panel = document.getElementById("diseases-panel");
                    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
                })
                // Tooltip text for accessibility and hover
                .append("title")
                .text(d => `${d.factor}: ${d.count} diseases`);

            // Add X axis at the bottom of the chart area
            const xAxis = svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x));

            // Rotate the x-axis labels so long factor names fit better
            xAxis.selectAll("text")
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end")
                .style("fill", "#000000");

            // Add Y axis on the left
            const yAxis = svg.append("g")
                .call(d3.axisLeft(y).ticks(10));

            yAxis.selectAll("text")
                .style("fill", "#000000");

            // Add Y axis label (rotated)
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Number of Diseases");

            // Add X axis label centered under the x-axis ticks
            svg.append("text")
                .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Risk Factors");

            // Style axis lines and ticks to ensure they are visible
            svg.selectAll(".domain, .tick line")
                .style("stroke", "#000000");
        }

        /**
         * init
         * - Orchestrates data fetch, preparation and rendering.
         * - Handles the empty-data case to inform the user.
         */
        async function init() {
            // Fetch data from the SPARQL endpoint (Wikidata)
            allData = await fetchData();

            // If no data was returned, show a helpful message
            if (allData.length === 0) {
                console.warn("No data available to display");
                const loadingEl = document.getElementById("loading-message");
                loadingEl.textContent = "No data available";
                loadingEl.classList.remove("hidden");
                return;
            }

            // Log raw data for debugging purposes (developer console)
            console.log("Raw Data:", allData);

            // Prepare the chart data (group by factor and count unique diseases)
            const chartData = prepareChartData(allData);
            console.log("Chart Data:", chartData);

            // Draw the chart
            drawChart(chartData);

            // Optional: make the chart responsive to window resize so axis labels remain visible
            // Debounce the resize handler to avoid excessive redraws.
            let resizeTimeout;
            window.addEventListener("resize", () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    // Re-draw using the same chart data and container dimensions
                    drawChart(chartData);
                }, 200);
            });
        }

        // Kick off the visualization when the page loads
        init();
    </script>
