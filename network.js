/////////////// CONVERSION OF JSON FILES

// Read the disease.json file
async function loadJSON(file) {
  const response = await fetch(file); // fetch is an asynchronous function, await makes sure the function is done before moving on
  const data = await response.json(); // converts the fetch output back into json
  return data; 
};

// Build hierarchical data for D3
const data = await loadJSON("diseases_smoking.json");

// Create nodes — start with smoking
const nodes = [{ id: 1, name: "smoking" }];

// Add disease nodes
data.forEach((item, index) => {
  nodes.push({
    id: index + 2, // IDs start at 2
    name: item.diseaseLabel
  });
});

// Create links — all from smoking (id 1)
const links = data.map((_, index) => ({
  source: 1,
  target: index + 2
}));

// Combine into final network object
const network = { nodes, links };

// Write to network.json   fs.writeFileSync("network.json", JSON.stringify(network, null, 2));    console.log(`✅ Created network.json with ${data.length} diseases`);

/////////////// CREATE NETWORK

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 30, left: 40},
  width = 400 - margin.left - margin.right,
  height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
var svg = d3.select("#my_dataviz")
.append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
.append("g")
  .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

d3.json(network, function(data) {

  // Initialize the links
  var link = svg
    .selectAll("line")
    .data(data.links)
    .enter()
    .append("line")
      .style("stroke", "#aaa")

  // Initialize the nodes
  var node = svg
    .selectAll("circle")
    .data(data.nodes)
    .enter()
    .append("circle")
      .attr("r", 20)
      .style("fill", "#69b3a2")

  // Let's list the force we wanna apply on the network
  var simulation = d3.forceSimulation(data.nodes)                 // Force algorithm is applied to data.nodes
      .force("link", d3.forceLink()                               // This force provides links between nodes
            .id(function(d) { return d.id; })                     // This provide  the id of a node
            .links(data.links)                                    // and this the list of links
      )
      .force("charge", d3.forceManyBody().strength(-400))         // This adds repulsion between nodes. Play with the -400 for the repulsion strength
      .force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area
      .on("end", ticked);

  // This function is run at each iteration of the force algorithm, updating the nodes position.
  function ticked() {
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node
         .attr("cx", function (d) { return d.x+6; })
         .attr("cy", function(d) { return d.y-6; });
  }

});
