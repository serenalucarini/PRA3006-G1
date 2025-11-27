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
    if (d.type === "labelSymptoms" || d.type === "labelRisks") return 10;
    return 22; // children
}

function nodeColor(d) {
    if (d.type === "disease") return "#7393B3";          // steel-ish blue
    if (d.type === "symptoms") return "#00008B";         // dark blue
    if (d.type === "risk") return "#5D3FD3";             // purple
    if (d.type === "symptomDetail") return "#CCCCFF";    // light lavender
    if (d.type === "riskDetail") return "#008080";       // teal
    if (d.type === "noSymptoms" || d.type === "noRisks") return "#bfbfbf"; // grey
    if (d.type === "labelSymptoms" || d.type === "labelRisks") return "e8e8e8";
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
    const childNames = nodes
        .filter(n => n.parent === parentLabel)
        .map(n => n.name);

    // remove links involving those children
    nodes = nodes.filter(n => n.parent !== parentLabel);
    links = links.filter(l => {
        const s = typeof l.source === "string" ? l.source : l.source.name;
        const t = typeof l.target === "string" ? l.target : l.target.name;
        return !childNames.includes(s) && !childNames.includes(t);
    });
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
        // grey "no symptoms" bubble
        const obj = {
            name: "No symptoms available",
            type: "noSymptoms",
            parent: "Symptoms"
        };
        nodes.push(obj);
        links.push({ source: "Symptoms", target: obj.name });
        // label
        const labelNode = {
            name: "No Known Symptoms",
            type: "labelSymptoms",
            parent: "Symptoms"
        };
        nodes.push(labelNode);
        links.push({ source: "Symptoms", target: labelNode.name });
        
    } else {
        symptoms.forEach(sym => {
            const obj = { name: sym, type: "symptomDetail", parent: "Symptoms" };
            nodes.push(obj);
            links.push({ source: "Symptoms", target: sym });
        });
        const labelNode = {
            name: "Click a symptom for details",
            type: "labelSymptoms",
            parent: "Symptoms"
        };
        nodes.push(labelNode);
        links.push({ source: "Symptoms", target: labelNode.name });
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

        // label node
        const labelNode = {
            name: "No Additional Risk Factors",
            type: "labelRisks",
            parent: "Risk Factors"
        };
        nodes.push(labelNode);
        links.push({ source: "Risk Factors", target: labelNode.name });

    } else {
        risks.forEach(risk => {
            const obj = { name: risk, type: "riskDetail", parent: "Risk Factors" };
            nodes.push(obj);
            links.push({ source: "Risk Factors", target: risk });
        });

        // label node
        const labelNode = {
            name: "Click a risk factor for details",
            type: "labelRisks",
            parent: "Risk Factors"
        };
        nodes.push(labelNode);
        links.push({ source: "Risk Factors", target: labelNode.name });
    }

    restartSimulation();
}


// Re-render everything after expanding (smooth animations)

function restartSimulation() {
    // update link force with current links array
    sim.force("link").links(links);

    // LINKS
    link = linkGroup.selectAll("line")
        .data(links, d => {
            const s = typeof d.source === "string" ? d.source : d.source.name;
            const t = typeof d.target === "string" ? d.target : d.target.name;
            return s + "->" + t;
        });

    link.exit().remove();

    const linkEnter = link.enter()
        .append("line")
        .attr("stroke", "#ccc")
        .attr("stroke-opacity", 0);

    linkEnter.transition().duration(300)
        .attr("stroke-opacity", 1);

    link = linkEnter.merge(link);

    // NODES
    node = nodeGroup.selectAll("circle")
        .data(nodes, d => d.name);

    node.exit()
        .transition().duration(250)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    const nodeEnter = node.enter()
        .append("circle")
        .attr("r", 0)
        .attr("fill", d => nodeColor(d))
        .style("opacity", 0)
        .style("cursor", d =>
            d.type === "symptoms" || d.type === "risk" ? "pointer" : "default"
        )
        .style("pointer-events", d=>
            d.type === "labelsymptoms" || d.type === "labelRisks"
            ? "none"
            : "auto"
        )
        .on("click", (event, d) => {
            if (d.type === "symptoms") toggleSymptoms();
            if (d.type === "risk") toggleRiskFactors();
        })
        .on("mouseover", (event, d) => {
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

    nodeEnter.transition().duration(400)
        .attr("r", d => nodeRadius(d))
        .style("opacity", 1);

    node = nodeEnter.merge(node)
        .attr("fill", d => nodeColor(d));

    // LABELS – only for main + category nodes
    const labelData = nodes.filter(d =>
        d.type === "disease" || d.type === "symptoms" || d.type === "risk"
    );

    label = labelGroup.selectAll("text")
        .data(labelData, d => d.name);

    label.exit()
        .transition().duration(250)
        .style("opacity", 0)
        .remove();

    const labelEnter = label.enter()
        .append("text")
        .text(d => d.name)
        .attr("font-size", d => d.type === "disease" ? "18px" : "14px")
        .attr("font-weight", d => d.type === "disease" ? "bold" : "normal")
        .attr("text-anchor", "middle")
        .attr("dy", 5)
        .style("opacity", 0);

    labelEnter.transition().duration(400)
        .style("opacity", 1);

    label = labelEnter.merge(label);

    // update simulation with new nodes
    sim.nodes(nodes);
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
        .attr("cx", d => {
            d.x = Math.max(nodeRadius(d) + 10, Math.min(width - nodeRadius(d) - 10, d.x));
            return d.x;
        })
        .attr("cy", d => {
            d.y = Math.max(nodeRadius(d) + 10, Math.min(height - nodeRadius(d) - 10, d.y));
            return d.y;
        });
        
    label
        .attr("x", d => d.x)
        .attr("y", d => d.y - 28);
});
