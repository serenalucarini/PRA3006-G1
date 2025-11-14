// Define the SPARQL endpoint
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

// Build hierarchical data for D3
async function buildHierarchicalData() {
  const diseases = await fetchData();
  const symptoms = await fetchData();
  const riskFactors = await fetchData();
  // Map diseases by name for quick lookup
  const diseaseMap = {};
  diseases.forEach(d => {
    const name = d.label || d.disease;
    diseaseMap[name] = { name, type: "disease", children: [] };
  });
// Attach symptoms and risk factors to each disease
  diseases.forEach(d => {
    const diseaseName = d.label || d.disease;
    const node = diseaseMap[diseaseName];
    
    // Symptoms
    const diseaseSymptoms = symptoms
      .filter(s => s.disease === diseaseName)
      .map(s => ({ name: s.symptomLabel || s.symptom, type: "symptom", children: []}));
    node.children.push(...diseaseSymptoms);
    
    // Risk factors
    const diseaseRiskFactors = riskFactors
      .filter(rf => rf.disease === diseaseName)
      .map(rf => {
        const childrenDiseases = diseases
          .filter(other => other.label === rf.factorLabel || other.disease === rf.factor)
          .map(o => ({ name: o.label || o.disease, type: "disease", children: [] }));
        return {
          name: rf.factorLabel || rf.factor,
          type: "riskFactor",
          children: childrenDiseases
        };
      });
    node.children.push(...diseaseRiskFactors);
  });
  
// Root node: Smoking
  return {
    name: "Smoking",
    type: "root",
    children: Object.values(diseaseMap)
  };
}
// Flatten hierarchical data into nodes and links
function flattenData(root) {
  const nodes = [];
  const links = []
  function recurse(node, parent = null) {
    nodes.push(node);
    if (parent) {
      links.push({ source: parent, target: node });
    }
    if (node.children) {
      node.children.forEach(child => recurse(child,node));
    }
  }
  recurse(root);
  return { nodes, links };
}
  
// Render force-directed clickable graph
async function renderGraph() {
  const data = await buildHierarchicalData(); 

  const width = 900;
  const height = 700;

  const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const { nodes, links } = flattenData(data);

  // Fix root in center
  data.fx = width / 2
  data.fy = height / 2
  
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(120).id(d => d.name))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Draw links
  const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", "#999")
        .attr("stroke-width", 2);

  // Draw nodes
   const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", 20)
        .attr("fill", d => {
            if(d.type === "root") return "red";
            if(d.type === "disease") return "steelblue";
            if(d.type === "symptom") return "green";
            if(d.type === "riskFactor") return "orange";
            return "gray";
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", expandNode);

  // Node labels
  const label = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .attr("dy", 4)
        .attr("text-anchor", "middle")
        .text(d => d.name);

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

      function expandNode(event, d) {
        if (!d.children || d.children.length === 0) return;

        d.children.forEach(c => {
            if (!nodes.includes(c)) {
                nodes.push(c);
                links.push({ source: d, target: c });

                // Add circle for new node
                svg.select(".nodes")
                    .append("circle")
                    .data([c])
                    .attr("r", 20)
                    .attr("fill", () => {
                        if(c.type === "disease") return "steelblue";
                        if(c.type === "symptom") return "green";
                        if(c.type === "riskFactor") return "orange";
                        return "gray";
                    })
                    .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended))
                    .on("click", expandNode);

                // Add label
                svg.select(".labels")
                    .append("text")
                    .data([c])
                    .attr("dy", 4)
                    .attr("text-anchor", "middle")
                    .text(c.name);
            }
        });

        d._children = d.children;
        d.children = [];
        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        if(d.type !== "root") {
          d.fx = null; 
          d.fy = null; 
        }
    }
}

window.onload = renderGraph;
