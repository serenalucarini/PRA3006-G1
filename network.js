/////// Define the SPARQL endpoint
const sparqlEndpoint = "https://query.wikidata.org/sparql";

// Function to fetch data from SPARQL endpoint
async function fetchData() {
    const loadingMessage = document.getElementById("loading-message");
    loadingMessage.classList.remove("hidden");

    const sparqlQuery = `
    SELECT ?disease ?diseaseLabel ?symptom ?symptomLabel
    WHERE {
      ?disease wdt:P5642 wd:Q662860.   # smoking is a risk factor
      ?disease wdt:P780 ?symptom.      # disease has symptom
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;

    try {
        const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
            headers: { Accept: "application/json" },
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const json = await response.json();
        return json.results.bindings.map((row) => ({
            disease: row.disease.value,
            diseaseLabel: row.diseaseLabel.value,
            factor: row.factor.value,
            factorLabel: row.factorLabel.value,
        }));
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    } finally {
        loadingMessage.classList.add("hidden");
    }
}

const SmokingDiseases = fetchData()

/////// CONVERSION INTO REQUIRED JSON

d3.json(SmokingDiseases).then(data => {
  console.log(Array.isArray(data)); // should be true
  console.log("Number of diseases:", data.length); // gives size

  // Create nodes — start with smoking, will be the root of the network
  const nodes = [{ id: 1, name: "smoking" }];

  // Add disease nodes, iteration
  data.forEach((item, index) => {
    nodes.push({
      id: index + 2,
      name: item.diseaseLabel
    });
  });

  // Create links — all from smoking (id 1), iteration
  const links = data.map((_, index) => ({
    source: 1,
    target: index + 2
  }));

  // Combine into final network object
  const network = { nodes, links };
  console.log(network);

  /////// MAKE NETWORK

const headerHeight = window.innerHeight * 0.20; // since header and footer are 15%
const footerHeight = window.innerHeight * 0.20;
const width = window.innerWidth * 0.7;  // percentage of viewport width
const height = window.innerHeight - headerHeight - footerHeight;

  // append the svg object to the body of the page
  const svg = d3.select("#circle")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("margin-top", headerHeight + "px"); // pushes network below header

  // Initialize the links
  const link = svg
    .selectAll("line")
    .data(network.links)
    .enter()
    .append("line")
    .style("stroke", "#aaa");

  // Initialize the nodes
const tooltip = d3.select("#tooltip");

const node = svg.append("g")
  .selectAll("circle")
  .data(network.nodes)
  .join("circle")
  .attr("r", 15)
  .attr("fill", 0)
  .on("mouseover", (event, d) => { // show tooltip with node name
      tooltip
        .style("opacity", 1)
        .html(d.name);
  })
  .on("mousemove", (event) => { // move tooltip near cursor
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 15) + "px");
  })
  .on("mouseout", () => { // hide tooltip
      tooltip.style("opacity", 0);
  });

// Create simulation
const simulation = d3.forceSimulation(network.nodes)
  .force("link", d3.forceLink(network.links).id(d => d.id).distance(100))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .alphaDecay(0.02)
  .on("tick", ticked);
  
  function ticked() {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
    .attr("cx", d => Math.max(20, Math.min(width - 20, d.x))) // prevent cutoff
    .attr("cy", d => Math.max(20, Math.min(height - 20, d.y)));
  }
});
