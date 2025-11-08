/////// CONVERSION INTO REQUIRED JSON

d3.json("diseases_smoking.json").then(data => {
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

  // set the dimensions and margins of the graph
  const margin = { top: 10, right: 30, bottom: 30, left: 40 },
    width = 800 - margin.left - margin.right,
    height = 800 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("#circle")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Initialize the links
  const link = svg
    .selectAll("line")
    .data(network.links)
    .enter()
    .append("line")
    .style("stroke", "#aaa");

  // Initialize the nodes
  const node = svg
    .selectAll("circle")
    .data(network.nodes)
    .enter()
    .append("circle")
    .attr("r", 6)
    .style("fill", "#E6E6FA"); // colour lavender to match header and footer

  const label = svg.append("g")
  .selectAll("text")
  .data(network.nodes)
  .join("text")
  .text(d => d.name)
  .attr("font-size", 10)
  .attr("dx", 8)  // small offset so labels don’t overlap nodes
  .attr("dy", 4)
  .attr("fill", "black");

// Create simulation
const simulation = d3.forceSimulation(network.nodes)
  .force("link", d3.forceLink(network.links)
    .id(d => d.id)
    .distance(200)
  )
  .force("charge", d3.forceManyBody().strength(-1000)) // repulsion
  .force("center", d3.forceCenter(width / 2, height / 2))
  .on("tick", ticked);

simulation.alphaDecay(0.02);
  
  function ticked() {
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
  }
});
