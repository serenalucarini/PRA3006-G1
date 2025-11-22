// Get disease name from URL
const params = new URLSearchParams(window.location.search);
const diseaseName = params.get("name")|| "Unknown disease";
const titleEl = document.getElementById("title");
if (titleEl) titleEl.textContent = diseaseName;

// SPARQL Queries
async function fetchSymptoms(diseaseName) {
    const query = `
    SELECT ?symptomLabel WHERE {
      ?disease rdfs:label "${diseaseName}"@en.
      ?disease wdt:P780 ?symptom.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;
    const res = await fetch(
        "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query),
        { headers: { "Accept": "application/sparql-results+json" } }
    );
    const data = await res.json();
    return data.results.bindings.map(b => b.symptomLabel.value);
}
async function fetchRiskFactors(diseaseName) {
    const query = `
    SELECT ?factorLabel WHERE {
      ?disease rdfs:label "${diseaseName}"@en.
      ?disease wdt:P5642 ?factor.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;
    const res = await fetch(
        "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query),
        { headers: { "Accept": "application/sparql-results+json" } }
    );
    const data = await res.json();
    return data.results.bindings.map(b => b.factorLabel.value);
}

// Create base nodes
let nodes = [
    { name: diseaseName, type: "disease" },
    { name: "Symptoms", type: "symptoms" },
    { name: "Risk Factors", type: "risk" }
];

let links = [
    { source: diseaseName, target: "Symptoms" },
    { source: diseaseName, target: "Risk Factors" }
];

let expandedSymptoms = false;
let expandedRisks = false;

// Build SVG + Force Simulation
const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("overflow", "visible");

// Zoom container
const zoomGroup = svg.append("g");

// Groups inside zoom container    
const linkGroup = zoomGroup.append("g");
const nodeGroup = zoomGroup.append("g");
const labelGroup = zoomGroup.append("g");

// tooltip for children
const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("border-radius", "10px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.2)")
    .style("background", "white")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("transition", "opacity 0.15s ease-out");

let link = linkGroup.selectAll("line");
let node = nodeGroup.selectAll("circle");
let label = labelGroup.selectAll("text");

// zoom + pan
const zoom = d3.zoom()
    .scaleExtent([0.5, 4])
    .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
    });
svg.call(zoom);

const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.name).distance(200))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(35));

// Visual Help
function nodeRadius(d) {
    if (d.type === "disease") return 45;   // big center
    if (d.type === "symptoms" || d.type === "risk") return 35; // category
    return 22; // children
}

function nodeColor(d) {
    if (d.type === "disease") return "#7393B3";          // steel-ish blue
    if (d.type === "symptoms") return "#00008B";         // dark blue
    if (d.type === "risk") return "#5D3FD3";             // purple
    if (d.type === "symptomDetail") return "#CCCCFF";    // light lavender
    if (d.type === "riskDetail") return "#008080";       // teal
    if (d.type === "noSymptoms" || d.type === "noRisks") return "#bfbfbf"; // grey
    return "gray";
}
    
// Drag behaviour for nodes
const drag = d3.drag()
    .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    })
    .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
    })
    .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    });

// Functions to expand graph
function collapseChildren(parentLabel) {
    // get all children for removal
    const children = nodes.filter(n => n.parent === parentLabel);
    // remove child nodes safely
    children.forEach(child => {
        const index = nodes.indexOf(child);
        if (index !== -1) {
            nodes.splice(index, 1);
        }
    });

    // remove links involving those children
    for (let i = links.length - 1; i >= 0; i--) {
        const s = typeof links[i].source === "string" ? links[i].source : links[i].source.name;
        const t = typeof links[i].target === "string" ? links[i].target : links[i].target.name;

        if (children.some(c => c.name === s || c.name === t)) {
            links.splice(i, 1);
        }
    }
}
// Symptoms toggle
async function toggleSymptoms() {
    // COLLAPSE
    if (expandedSymptoms) {
        expandedSymptoms = false;
        collapseChildren("Symptoms");
        restartSimulation();
        return;
    }
    // EXPAND
    expandedSymptoms = true;

    const symptoms = await fetchSymptoms(diseaseName);

    if (symptoms.length === 0) {
        const obj = {
            name: "No symptoms available",
            type: "noSymptoms",
            parent: "Symptoms"
        };
        nodes.push(obj);
        links.push({ source: "Symptoms", target: obj.name });
    } else {
        symptoms.forEach(sym => {
            const obj = { name: sym, type: "symptomDetail", parent: "Symptoms" };
            nodes.push(obj);
            links.push({ source: "Symptoms", target: sym });
        });
    }
    restartSimulation();
}
// Risk Factors Toggle
async function toggleRiskFactors() {
    // COLLAPSE
    if (expandedRisks) {
        expandedRisks = false;
        collapseChildren("Risk Factors");
        restartSimulation();
        return;
    }
    // EXPAND
    expandedRisks = true;
    const risks = await fetchRiskFactors(diseaseName);
    if (risks.length === 0) {
        const obj = {
            name: "No risk factors available",
            type: "noRisks",
            parent: "Risk Factors"
        };
        nodes.push(obj);
        links.push({ source: "Risk Factors", target: obj.name });
    } else {
        risks.forEach(risk => {
            const obj = { name: risk, type: "riskDetail", parent: "Risk Factors" };
            nodes.push(obj);
            links.push({ source: "Risk Factors", target: risk });
        });
    }
    restartSimulation();
}

// Re-render everything after expanding (smooth animations)

function restartSimulation() {

    // update links
    link = linkGroup.selectAll("line")
        .data(links)
        .join(
            enter => enter.append("line")
                .attr("stroke", "#ccc")
                .attr("stroke-opacity", 0)
                .call(enter => enter.transition().duration(300)
                    .attr("stroke-opacity", 1)),
            update => update,
            exit => exit.transition().duration(250)
                .attr("stroke-opacity", 0)
                .remove()
        );

    // update nodes
    node = nodeGroup.selectAll("circle")
        .data(nodes, d => d.name)
        .join(
            enter => {
                const c = enter.append("circle")
                    .attr("r", 0)
                    .attr("fill", d => nodeColor(d))
                    .style("opacity", 0)
                    .style("cursor", d =>
                        d.type === "symptoms" || d.type === "risk"
                            ? "pointer"
                            : "default"
                    )
                    .on("click", (event, d) => {
                        if (d.type === "symptoms") toggleSymptoms();
                        if (d.type === "risk") toggleRiskFactors();
                    })
                    .on("mouseover", (event, d) => {
                        // show tooltip only for children & no-data nodes
                        if (
                            d.type === "symptomDetail" ||
                            d.type === "riskDetail" ||
                            d.type === "noSymptoms" ||
                            d.type === "noRisks"
                        ) {
                            tooltip
                                .style("opacity", 1)
                                .html(d.name);
                        }
                    })
                    .on("mousemove", (event) => {
                        tooltip
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 10) + "px");
                    })
                    .on("mouseout", () => {
                        tooltip.style("opacity", 0);
                    })
                    .call(drag);

                c.transition()
                    .duration(400)
                    .attr("r", d => nodeRadius(d))
                    .style("opacity", 1);

                return c;
            },
            update => update.transition()
                .duration(300)
                .attr("fill", d => nodeColor(d))
                .attr("r", d => nodeRadius(d)),
            exit => exit.transition()
                .duration(250)
                .attr("r", 0)
                .style("opacity", 0)
                .remove()
        );

    // labels ONLY for main + category nodes
    const labelData = nodes.filter(d =>
        d.type === "disease" || d.type === "symptoms" || d.type === "risk"
    );

    label = labelGroup.selectAll("text")
        .data(labelData, d => d.name)
        .join(
            enter => enter.append("text")
                .text(d => d.name)
                .attr("font-size", d => d.type === "disease" ? "18px" : "14px")
                .attr("font-weight", d => d.type === "disease" ? "bold" : "normal")
                .attr("text-anchor", "middle")
                .attr("dy", 5)
                .style("opacity", 0)
                .transition().duration(400)
                .style("opacity", 1),
            update => update,
            exit => exit.transition().duration(250)
                .style("opacity", 0)
                .remove()
        );

    // restart simulation with new data
    sim.nodes(nodes);
    sim.force("link").links(links);
    sim.alpha(1).restart();
}

// Initial render
restartSimulation();

sim.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x = Math.max(50, Math.min(width - 50, d.x)))
        .attr("cy", d => d.y = Math.max(50, Math.min(height - 50, d.y)));

    label
        .attr("x", d => d.x)
        .attr("y", d => d.y - 28);
});
