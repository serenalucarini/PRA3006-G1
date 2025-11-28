/* -------------------------------------------------------
   Get disease name from URL
------------------------------------------------------- */
const params = new URLSearchParams(window.location.search);
const diseaseName = params.get("name") || "Unknown disease";
document.getElementById("headerDiseaseName").textContent = diseaseName;

/* -------------------------------------------------------
   SPARQL Queries
------------------------------------------------------- */
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

/* -------------------------------------------------------
   Base Nodes + Links
------------------------------------------------------- */
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

/* Text labels for cases with no data */
let symptomsTextLabel = null;
let riskTextLabel = null;

/* -------------------------------------------------------
   SVG + Groups
------------------------------------------------------- */
const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("overflow", "visible");

const zoomGroup = svg.append("g");
const linkGroup = zoomGroup.append("g");
const nodeGroup = zoomGroup.append("g");
const labelGroup = zoomGroup.append("g");

let link = linkGroup.selectAll("line");
let node = nodeGroup.selectAll("circle");
let label = labelGroup.selectAll("text");

/* Zoom */
svg.call(
    d3.zoom()
        .scaleExtent([0.5, 4])
        .on("zoom", event => zoomGroup.attr("transform", event.transform))
);

/* Force Simulation */
const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.name).distance(200))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(35));

/* -------------------------------------------------------
   Visual Settings
------------------------------------------------------- */
function nodeRadius(d) {
    if (d.type === "disease") return 45;
    if (d.type === "symptoms" || d.type === "risk") return 35;
    return 22; // children
}

function nodeColor(d) {
    if (d.type === "disease") return "#7393B3";
    if (d.type === "symptoms") return "#00008B";
    if (d.type === "risk") return "#5D3FD3";
    if (d.type === "symptomDetail") return "#CCCCFF";
    if (d.type === "riskDetail") return "#008080";
    if (d.type === "noSymptoms" || d.type === "noRisks") return "#bfbfbf";
    return "gray";
}

/* -------------------------------------------------------
   Drag behaviour
------------------------------------------------------- */
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

/* -------------------------------------------------------
   Remove children of parent
------------------------------------------------------- */
function collapseChildren(parentLabel) {
    const childNames = nodes
        .filter(n => n.parent === parentLabel)
        .map(n => n.name);

    nodes = nodes.filter(n => n.parent !== parentLabel);
    links = links.filter(l => {
        const s = typeof l.source === "string" ? l.source : l.source.name;
        const t = typeof l.target === "string" ? l.target : l.target.name;
        return !childNames.includes(s) && !childNames.includes(t);
    });
}

/* -------------------------------------------------------
   TOGGLE SYMPTOMS
------------------------------------------------------- */
async function toggleSymptoms() {

    // COLLAPSE
    if (expandedSymptoms) {
        expandedSymptoms = false;
        collapseChildren("Symptoms");

        if (symptomsTextLabel) {
            symptomsTextLabel.remove();
            symptomsTextLabel = null;
        }

        restartSimulation();
        return;
    }

    // EXPAND
    expandedSymptoms = true;
    const symptoms = await fetchSymptoms(diseaseName);

    if (symptoms.length === 0) {

        symptomsTextLabel = labelGroup.append("text")
            .text("No symptoms available")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .style("fill", "#444")
            .style("opacity", 0);

        symptomsTextLabel.transition().duration(250).style("opacity", 1);

    } else {

        symptoms.forEach(sym => {
            nodes.push({ name: sym, type: "symptomDetail", parent: "Symptoms" });
            links.push({ source: "Symptoms", target: sym });
        });
    }

    restartSimulation();
}

/* -------------------------------------------------------
   TOGGLE RISK FACTORS
------------------------------------------------------- */
async function toggleRiskFactors() {

    // COLLAPSE
    if (expandedRisks) {
        expandedRisks = false;
        collapseChildren("Risk Factors");

        if (riskTextLabel) {
            riskTextLabel.remove();
            riskTextLabel = null;
        }

        restartSimulation();
        return;
    }

    // EXPAND
    expandedRisks = true;
    const risks = await fetchRiskFactors(diseaseName);

    if (risks.length === 0) {

        riskTextLabel = labelGroup.append("text")
            .text("No risk factors available")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .style("fill", "#444")
            .style("opacity", 0);

        riskTextLabel.transition().duration(250).style("opacity", 1);

    } else {

        risks.forEach(risk => {
            nodes.push({ name: risk, type: "riskDetail", parent: "Risk Factors" });
            links.push({ source: "Risk Factors", target: risk });
        });
    }

    restartSimulation();
}

/* -------------------------------------------------------
   RENDER
------------------------------------------------------- */
function restartSimulation() {

    sim.force("link").links(links);

    /* LINKS */
    link = linkGroup.selectAll("line")
        .data(links, d => (d.source.name ?? d.source) + "->" + (d.target.name ?? d.target));

    link.exit().remove();

    const linkEnter = link.enter()
        .append("line")
        .attr("stroke", "#ccc")
        .attr("stroke-opacity", 0);

    linkEnter.transition().duration(300).attr("stroke-opacity", 1);

    link = linkEnter.merge(link);

    /* NODES */
    node = nodeGroup.selectAll("circle")
        .data(nodes, d => d.name);

    node.exit()
        .transition().duration(200)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    const nodeEnter = node.enter()
        .append("circle")
        .attr("r", 0)
        .attr("fill", d => nodeColor(d))
        .style("cursor", d =>
            d.type === "symptoms" || d.type === "risk" ? "pointer" : "default"
        )
        .on("click", (event, d) => {
            if (d.type === "symptoms") toggleSymptoms();
            if (d.type === "risk") toggleRiskFactors();
        })
        .call(drag);

    nodeEnter.transition().duration(300)
        .attr("r", d => nodeRadius(d))
        .style("opacity", 1);

    node = nodeEnter.merge(node);

    /* MAIN LABELS:
       Disease — BELOW the bubble (1B)
       Symptoms / Risk — ABOVE their bubbles
    */
    const labelData = nodes.filter(
        d => d.type === "disease" || d.type === "symptoms" || d.type === "risk"
    );

    label = labelGroup.selectAll("text.mainlabel")
        .data(labelData, d => d.name);

    label.exit().remove();

    const labelEnter = label.enter()
        .append("text")
        .classed("mainlabel", true)
        .text(d => d.name)
        .attr("text-anchor", "middle")
        .attr("font-weight", d => d.type === "disease" ? "bold" : "normal")
        .attr("font-size", d => d.type === "disease" ? "20px" : "15px")
        .style("opacity", 0);

    labelEnter.transition().duration(300).style("opacity", 1);

    label = labelEnter.merge(label);

    /* CHILD LABELS — always above child nodes */
    const childLabelData = nodes.filter(
        d => d.type === "symptomDetail" || d.type === "riskDetail"
    );

    let childLabels = labelGroup.selectAll("text.childLabel")
        .data(childLabelData, d => d.name);

    childLabels.exit().remove();

    const childLabelEnter = childLabels.enter()
        .append("text")
        .classed("childLabel", true)
        .text(d => d.name)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .style("fill", "#333")
        .style("opacity", 0);

    childLabelEnter.transition().duration(250).style("opacity", 1);

    childLabels = childLabelEnter.merge(childLabels);

    sim.nodes(nodes);
    sim.alpha(1).restart();
}

/* INITIAL DRAW */
restartSimulation();

/* -------------------------------------------------------
   SIMULATION TICK
------------------------------------------------------- */
sim.on("tick", () => {

    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    /* MAIN LABELS POSITIONING */
    labelGroup.selectAll("text.mainlabel")
        .attr("x", d => d.x)
        .attr("y", d =>
            d.type === "disease"
                ? d.y + nodeRadius(d) + 20      // disease name BELOW (1B)
                : d.y - nodeRadius(d) - 20      // symptoms & risk ABOVE
        );

    /* No symptoms text */
    if (symptomsTextLabel) {
        const symNode = nodes.find(n => n.name === "Symptoms");
        if (symNode) {
            symptomsTextLabel
                .attr("x", symNode.x)
                .attr("y", symNode.y + nodeRadius(symNode) + 20);
        }
    }

    /* No risk factors text */
    if (riskTextLabel) {
        const riskNode = nodes.find(n => n.name === "Risk Factors");
        if (riskNode) {
            riskTextLabel
                .attr("x", riskNode.x)
                .attr("y", riskNode.y + nodeRadius(riskNode) + 20);
        }
    }

    /* CHILD LABELS ABOVE EACH CHILD NODE */
    labelGroup.selectAll("text.childLabel")
        .attr("x", d => d.x)
        .attr("y", d => d.y - nodeRadius(d) - 10);
});

