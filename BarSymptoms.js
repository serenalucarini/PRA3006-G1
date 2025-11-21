
        /*
         * SPARQL endpoint and global state
         * We keep allData global so other functions (chart / details panel) can access it easily.
         */
        const sparqlEndpoint = "https://query.wikidata.org/sparql";
        let allData = []; // Store all fetched rows here

        /**
         * fetchData()
         * - Fetches data from Wikidata via SPARQL
         * - Returns an array of simplified objects: { disease, diseaseLabel, symptoms, symptomsLabel }
         * - Shows the loading message while fetching and hides it on completion/error.
         */
        async function fetchData() {
            const loadingMessage = document.getElementById("loading-message");
            loadingMessage.classList.remove("hidden");

            // Query: find diseases linked to a smoking factor and their symptoms.
            const sparqlQuery = `
            SELECT ?disease ?diseaseLabel ?factor ?factorLabel ?symptoms ?symptomsLabel
            WHERE {
              ?disease wdt:P5642 wd:Q662860.
              ?disease wdt:P5642 ?factor .
              ?disease wdt:P780 ?symptoms.
              SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
            }`;

            try {
                // Perform the fetch to the SPARQL endpoint with JSON results
                const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
                    headers: { Accept: "application/json" },
                });

                if (!response.ok) {
                    // If the response is not OK, throw to be handled in catch
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }

                const json = await response.json();

                // Map the returned bindings into a simpler structure we use elsewhere
                return json.results.bindings.map((row) => ({
                    disease: row.disease.value,
                    diseaseLabel: row.diseaseLabel.value,
                    symptoms: row.symptoms.value,
                    symptomsLabel: row.symptomsLabel.value,
                }));
            } catch (error) {
                console.error("Error fetching data:", error);
                return [];
            } finally {
                // Always hide the loading message on completion/failure
                loadingMessage.classList.add("hidden");
            }
        }

        /**
         * prepareChartData(data)
         * - Accepts the raw rows from fetchData
         * - Groups rows by disease label and counts unique symptoms per disease
         * - Returns an array of { disease, count } sorted by count descending
         */
        function prepareChartData(data) {
            // Group rows by disease label
            const groupedByDisease = d3.group(data, (d) => d.diseaseLabel);

            // For each disease, compute the number of unique symptom items
            return Array.from(groupedByDisease, ([disease, values]) => {
                const uniqueSymptoms = new Set(values.map(v => v.symptoms));
                return {
                    disease: disease,
                    count: uniqueSymptoms.size
                };
            }).sort((a, b) => b.count - a.count);
        }

        /**
         * getSymptomsByDisease(diseaseName)
         * - Returns a sorted array of unique symptom labels for the given disease label string.
         */
        function getSymptomsByDisease(diseaseName) {
            const diseaseData = allData.filter(d => d.diseaseLabel === diseaseName);
            const uniqueSymptoms = [...new Set(diseaseData.map(d => d.symptomsLabel))];
            return uniqueSymptoms.sort();
        }

        /**
         * displaySymptoms(diseaseName)
         * - Populates the right-hand panel with the symptoms for the selected disease
         * - Shows the panel (adds 'active' class)
         */
        function displaySymptoms(diseaseName) {
            const symptoms = getSymptomsByDisease(diseaseName);
            const panel = document.getElementById("symptoms-panel");
            const titleEl = document.getElementById("selected-disease");
            const listEl = document.getElementById("symptoms-list");

            // Set title and clear previous list
            titleEl.textContent = diseaseName;
            listEl.innerHTML = "";

            // Append each symptom as a list item
            symptoms.forEach(symptom => {
                const li = document.createElement("li");
                li.className = "symptom-item";
                li.textContent = symptom;
                listEl.appendChild(li);
            });

            // Make the panel visible
            panel.classList.add("active");
        }

        /**
         * drawChart(chartData)
         * - Draws a bar chart inside #barchart-container using D3
         * - Dynamically sizes the chart to the container's available size so axis labels remain visible
         * - Adds click handling to show symptoms in the side panel
         * - Wraps long x-axis labels into multiple lines so they don't get cut off by the footer
         */
        function drawChart(chartData) {
            // Remove any previously-drawn SVG to allow redraw/resizing
            d3.select("#barchart-container").selectAll("svg").remove();

            // Margins: leave enough bottom margin for multiple lines of wrapped labels
            const margin = { top: 20, right: 30, bottom: 150, left: 60 };

            // Determine container size dynamically so we never draw under the footer.
            const containerEl = document.getElementById("barchart-container");
            const containerWidth = Math.max(containerEl.clientWidth, 600); // ensure a reasonable minimum width
            const containerHeight = Math.max(containerEl.clientHeight, 300); // ensure a reasonable minimum height

            // Compute inner chart width/height based on measured container dimensions
            const width = containerWidth - margin.left - margin.right;
            const height = Math.max(containerHeight - margin.top - margin.bottom, 80); // keep a minimum inner height

            // Create SVG sized to the container, including margins
            const svg = d3
                .select("#barchart-container")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // X scale: band scale for disease names
            const x = d3.scaleBand()
                .range([0, width])
                .domain(chartData.map(d => d.disease))
                .padding(0.2);

            // Y scale: linear from 0 up to the max count (fallback to 1)
            const maxCount = d3.max(chartData, d => d.count) || 1;
            const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, maxCount]);

            // Add bars: use .join to properly handle enter/update/exit if redrawn
            svg.selectAll(".bar")
                .data(chartData)
                .join("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.disease))
                .attr("y", d => y(d.count))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.count))
                .attr("fill", "#FF69B4")
                .on("click", function(event, d) {
                    // Clear active class from all bars, then add to clicked bar
                    svg.selectAll(".bar").classed("active", false);
                    d3.select(this).classed("active", true);
                    // Show the symptoms for the clicked disease
                    displaySymptoms(d.disease);
                })
                // Add a title tooltip to each bar for accessibility / hover feedback
                .append("title")
                .text(d => `${d.disease}: ${d.count} symptoms`);

            // X Axis
            const xAxis = svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x));

            // -------------------------------------------------------
            // Wrap long x-axis labels into multiple lines.
            // We remove rotation and instead perform word-wrapping into tspans
            // so labels remain readable and don't get cut by the footer.
            // -------------------------------------------------------
            xAxis.selectAll("text")
                .attr("y", 0)
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .call(wrap, x.bandwidth());

            // Y Axis
            svg.append("g")
                .call(d3.axisLeft(y).ticks(10))
                .selectAll("text")
                .style("fill", "#000000");

            // Y axis label (rotated)
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Amount of Symptoms");

            // X axis label
            svg.append("text")
                .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
                .style("text-anchor", "middle")
                .style("fill", "#000000")
                .text("Diseases");

            // Style axis lines (domain and ticks)
            svg.selectAll(".domain, .tick line")
                .style("stroke", "#000000");

            /**
             * wrap(textSelection, width)
             * - For each text element, splits the text into words and creates tspans
             *   so the text wraps at approximately the given width (px).
             * - Relies on getComputedTextLength to measure rendered width.
             */
            function wrap(textSelection, width) {
                const lineHeight = 1.1; // ems
                textSelection.each(function() {
                    const text = d3.select(this);
                    const words = text.text().split(/\s+/).reverse();
                    let word;
                    const x = text.attr("x");
                    const y = text.attr("y");
                    const dy = parseFloat(text.attr("dy")) || 0;
                    let tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
                    let line = [];
                    let lineNumber = 0;

                    while (word = words.pop()) {
                        line.push(word);
                        tspan.text(line.join(" "));
                        // when the tspan is too wide, move the last word to a new line
                        if (tspan.node().getComputedTextLength && tspan.node().getComputedTextLength() > width) {
                            line.pop();
                            tspan.text(line.join(" "));
                            line = [word];
                            lineNumber++;
                            tspan = text.append("tspan")
                                .attr("x", x)
                                .attr("y", y)
                                .attr("dy", (lineNumber * lineHeight + dy) + "em")
                                .text(word);
                        }
                    }
                });
            }
        }

        /**
         * init()
         * - Entry point when the page loads
         * - Fetches data, prepares it, and draws the chart
         * - If there's no data, shows a friendly message instead of a chart
         */
        async function init() {
            // Fetch SPARQL data and store globally
            allData = await fetchData();

            if (allData.length === 0) {
                // No data: show message and skip drawing
                console.warn("No data available to display");
                const lm = document.getElementById("loading-message");
                lm.textContent = "No data available";
                lm.classList.remove("hidden");
                return;
            }

            // Prepare data and draw the chart
            console.log("Raw Data:", allData);
            const chartData = prepareChartData(allData);
            console.log("Chart Data:", chartData);
            drawChart(chartData);

            // Optional: redraw the chart when the window resizes so axes remain visible
            // (debounce to avoid excessive redraws)
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    drawChart(chartData);
                }, 200);
            });
        }

        // Start the page logic
        init();
