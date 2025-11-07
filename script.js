// Load a JSON file 
async function loadJSON(file) {
  const response = await fetch(file);
  const data = await response.json();
  console.log("Loaded:", file, data.length);
  return data; 
}
// Build hierarchical data for D3
async function buildHierarchicalData() {
  const diseases = await loadJSON("diseases_smoking.json");
  const symptoms = await loadJSON("diseases_symptoms.json");
  const riskFactors = await loadJSON("diseases_risk_factors.json");
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
      .map(s => ({ name: s.symptomLabel || s.symptom, type: "symptom" }));
    node.children.push(...diseaseSymptoms);
    // Risk factors
    const diseaseRiskFactors = riskFactors
      .filter(rf => rf.disease === diseaseName)
      .map(rf => {
        const childrenDiseases = diseases
          .filter(other => other.label === rf.factorLabel || other.disease === rf.factor)
          .map(o => ({ name: o.label || o.disease, type: "disease" }));
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
// Render force-directed clickable graph
async function renderGraph() {
  const data = await buildHierarchicalData(); // <-- correct function name

  const width = 1200;
  const height = 800;

  const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Flatten the hierarchy (so all nodes are visible initially)
  let nodes = [];
  let links = [];
  const nodeByName = {};

  function flatten(node, parent = null) {
    const n = { id: node.name, name: node.name, type: node.type };
    nodes.push(n);
    nodeByName[n.id] = n;
    if (parent) links.push({ source: parent.id, target: n.id });
    if (node.children) node.children.forEach(c => flatten(c, n));
  }

  flatten(data);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(120))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const linkGroup = svg.append("g").attr("class", "links")
      .selectAll("line");

  const nodeGroup = svg.append("g").attr("class", "nodes")
      .selectAll("circle");

  function update() {
    // Update links
    const linkSelection = svg.select(".links")
      .selectAll("line")
      .data(links, d => d.source.id + "-" + d.target.id);

    linkSelection.enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", 1.5)
      .merge(linkSelection);

    linkSelection.exit().remove();

    // Update nodes
    const nodeSelection = svg.select(".nodes")
      .selectAll("circle")
      .data(nodes, d => d.id);

    nodeSelection.enter()
      .append("circle")
      .attr("r", 8)
      .attr("fill", d => {
        if (d.type === "root") return "red";
        if (d.type === "disease") return "steelblue";
        if (d.type === "symptom") return "green";
        if (d.type === "riskFactor") return "orange";
        return "gray";
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    nodeSelection.exit().remove();

    // Labels
    const text = svg.selectAll(".label")
      .data(nodes, d => d.id);

    text.enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", -10)
      .text(d => d.name.split("/").pop()) // shorten URI
      .merge(text);

    simulation.nodes(nodes);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();
  }

  simulation.on("tick", () => {
    svg.selectAll("line")
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    svg.selectAll("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    svg.selectAll("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });

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
    d.fx = null;
    d.fy = null;
  }

  update();
}



  
  
