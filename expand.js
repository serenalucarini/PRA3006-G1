async function loadJSON(file) {
    const res = await fetch(file);
    return res.json();
}

async function renderGraph() {
    const diseases = await loadJSON("diseases_smoking.json");

    const width = 900, height = 700;

    const svg = d3.select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const root = {
        name: "Smoking",
        type: "root",
        fx: width/2,
        fy: height/2
    };

    const nodes = [root];
    const links = [];

    diseases.forEach(d => {
        const name = d.diseaseLabel || d.disease;
        const node = { name, type: "disease" };
        nodes.push(node);
        links.push({ source: root, target: node });
    });

     // Initialize the nodes
const tooltip = d3.select("#tooltip");

const node = svg.append("g")
  .selectAll("circle")
  .data(network.nodes)
  .join("circle")
  .attr("r", 15)
  .attr("fill", d => d.isMain ? "#1f77b4" : "#87ceeb")
  .on("mouseover", (event, d) => { // show tooltip with node name
      if (!d.isMain) {
          // Change color on hover for disease nodes only
        d3.select(event.currentTarget)
          .attr("fill", "#ff6b6b") // red/coral on hover
          .attr("r", 20); // slightly larger
      tooltip
        .style("opacity", 1)
        .html(d.name);
  })
  .on("mousemove", (event) => { // move tooltip near cursor
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 15) + "px");
  })
  .on("mouseout", (event, d) => { // hide tooltip
      if (!d.isMain) {
          / Restore original color for disease nodes
        d3.select(event.currentTarget)
          .attr("fill", "#87ceeb")
          .attr("r", 15);
      }
      tooltip.style("opacity", 0);
  });

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).distance(200).id(d => d.name))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(width/2, height/2));

    const link = svg.append("g").selectAll("line")
        .data(links).enter().append("line")
        .attr("stroke", "#aaa");

    const node = svg.append("g").selectAll("circle")
        .data(nodes).enter()
        .append("circle")
        .attr("r", 22)
        .attr("fill", d => d.type==="root" ? "red" : "steelblue")
        .style("cursor","pointer")
        .on("click", (event, d) => {
            if (d.type === "disease") {
                const url = "disease.html?name=" + encodeURIComponent(d.name);
                window.location.href = url;
            }
        });

    const label = svg.append("g").selectAll("text")
        .data(nodes).enter()
        .append("text")
        .attr("text-anchor","middle")
        .attr("dy",5)
        .text(d => d.name);

    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x)
            .attr("y1", d=>d.source.y)
            .attr("x2", d=>d.target.x)
            .attr("y2", d=>d.target.y);

        node.attr("cx", d=>d.x)
            .attr("cy", d=>d.y);

        label.attr("x", d=>d.x)
             .attr("y", d=>d.y);
    });
}

window.onload = renderGraph;


