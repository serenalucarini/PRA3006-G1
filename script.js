// Load a JSON file 
async function loadJSON(file) {
  const response = await fetch(file);
  const data = await response.json();
  return data; 
}
// Build hierarchical data for D3
async function buildHierarchicalData() {
  const diseases = await loadJSON("diseases_smoking.json");
  const symptoms = await loadJSON("diseases_symptoms.json");

  return {
    name: "Smoking",
    children: diseases.map(disease => {
      const diseaseLabel = disease.label || disease.disease;
      const diseaseSymptoms = symptoms
        .filter(s => s.disease === diseaseLabel || s.disease === disease.disease)
        .map(s => ({ name: s.symptomLabel || s.symptom }));

      return {
        name: diseaseLabel,
        children: diseaseSymptoms
      };
    })
  };
}
async function renderGraph() {
  const data = await buildHierarchicalData();

  const width = 800, height = 600;
  const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(40,0)");

  let root = d3.hierarchy(data);
  root.x0 = height / 2;
  root.y0 = 0;

  // Collapse all nodes initially
  root.children.forEach(collapse);

  const tree = d3.tree().size([height, width - 160]);
  let i = 0;

  function collapse(d) {
    if(d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }

  function update(source) {
    const treeData = tree(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Nodes
    const node = svg.selectAll('g.node')
      .data(nodes, d => d.id || (d.id = ++i));

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${source.y0},${source.x0})`)
      .on('click', (event, d) => {
        if(d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      });

    nodeEnter.append('circle')
      .attr('r', 1e-6)
      .style('fill', d => d._children ? "lightsteelblue" : "#fff");

    nodeEnter.append('text')
      .attr('dy', 3)
      .attr('x', d => d.children || d._children ? -10 : 10)
      .style('text-anchor', d => d.children || d._children ? 'end' : 'start')
      .text(d => d.data.name);

    const nodeUpdate = nodeEnter.merge(node);
    nodeUpdate.transition().duration(200).attr('transform', d => `translate(${d.y},${d.x})`);
    nodeUpdate.select('circle').attr('r', 6).style('fill', d => d._children ? "lightsteelblue" : "#fff");

    // Links
    const link = svg.selectAll('path.link').data(links, d => d.target.id);
    const linkEnter = link.enter().insert('path', "g")
      .attr('class', 'link')
      .attr('d', d => {
        const o = {x: source.x0, y: source.y0};
        return diagonal(o, o);
      });

    linkEnter.merge(link).transition().duration(200).attr('d', d => diagonal(d.source, d.target));

    nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });

    function diagonal(s, d) {
      return `M ${s.y} ${s.x} C ${(s.y + d.y) / 2} ${s.x}, ${(s.y + d.y) / 2} ${d.x}, ${d.y} ${d.x}`;
    }
  }

  update(root);
}


// Call main function when the page loads
window.onload = renderGraph;

