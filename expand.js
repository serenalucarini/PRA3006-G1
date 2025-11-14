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
    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "6px 10px")
        .style("border", "1px solid #ccc")
        .style("font-size", "13px")
        .style("pointer-events", "none")
        .style("opacity", 0);
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
        if (!name) return;
        const node = { name, type: "disease" };
        nodes.push(node);
        links.push({ source: root, target: node });
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
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(`
                <strong>${d.name}</strong>
            `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.type === "disease") {
                const url = "disease.html?name=" + encodeURIComponent(d.name);
                window.location.href = url;
            }
        });
    // Root node label (always visible)
    const rootLabel = svg.append("text")
        .datum(root)
        .attr("text-anchor", "middle")
        .attr("dy", 5)
        .attr("font-weight", "bold")
        .text(d => d.name);
    sim.on("tick", () => {
        link.attr("x1", d=>d.source.x)
            .attr("y1", d=>d.source.y)
            .attr("x2", d=>d.target.x)
            .attr("y2", d=>d.target.y);
        node.attr("cx", d=>d.x)
            .attr("cy", d=>d.y);
        rootLabel.attr("x", d=>d.x)
                 .attr("y", d=>d.y);
    });
}
window.onload = renderGraph;
