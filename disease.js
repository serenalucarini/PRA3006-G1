/* -------------------------------------------------------
   Get disease name from URL
------------------------------------------------------- */
const params = new URLSearchParams(window.location.search);
const diseaseName = params.get("name") || "Unknown disease";
const titleEl = document.getElementById("title");
if (titleEl) titleEl.textContent = diseaseName;

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

/* Floating text labels (NOT nodes) */
let symptomsTextLabel = null;
let riskTextLabel = null;

/* -------------------------------------------------------
   Build SVG + Simulation
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

/* Tooltip */
const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("border-radius", "10px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.2)")
    .style("background", "white")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", 0);

let link = linkGroup.selectAll("line");
let node = nodeGroup.selectAll("circle");
let label = labelGroup.selectAll("text");

/* Zoom + Pan */
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
    return 22;
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
   Remove children of Symptoms or Risk Factors
------------------------------------------------------- */
function collapseChildren(parentLabel) {
    const childNames = nodes.filter(n => n.parent === parentLabel).map(n => n.name);

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
            .style("fill", "#555")
            .style("opacity", 0);

        symptomsTextLabel.transition().duration(250).style("opacity", 1);

    } else {

        symptoms.forEach(sym => {
            nodes.push({ name: sym, type: "symptomDetail", parent: "Symptoms" });
            links.push({ source: "Symptoms", target: sym });
        });

        symptomsTextLabel = labelGroup.append("text")
            .text("Click a symptom for details")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .style("fill", "#555")
            .style("opacity", 0);

        symptomsTextLabel.transition().duration(250).style("opacity", 1);
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
            .style("fill", "#555")
            .style("opacity", 0);

        riskTextLabel.transition().duration(250).style("opacity", 1);

    } else {

        risks.forEach(risk => {
            nodes.push({ name: risk, type: "riskDetail", parent: "Risk Factors" });
            links.push({ source: "Risk Factors", target: risk });
        });

        riskTextLabel = labelGroup.append("text")
            .text("Click a risk factor for details")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .style("fill", "#555")
            .style("opacity", 0);

        riskTextLabel.transition().duration(250).style("opacity", 1);
    }

    restartSimulation();
}

/* -------------------------------------------------------
   Re-render graph
------------------------------------------------------- */
function restartSimulation() {

    sim.force("link").links(links);

    /* LINKS */
    link = linkGroup.selectAll("line")
        .data(links, d => {
            const s = typeof d.source === "string" ? d.source : d.source.name;
            const t = typeof d.target === "string" ? d.target : d.target.name;
            return `${s}->${t}`;
        });

    link.exit().remove();

    link = link.enter()
        .append("line")
        .attr("stroke", "#ccc")
        .attr("stroke-opacity", 0)
        .transition().duration(300)
        .attr("stroke-opacity", 1)
        .selection()
        .merge(link);

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
        .style("opacity", 0)
        .style("cursor", d =>
            d.type === "symptoms" || d.type === "risk" ? "pointer" : "default"
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
                tooltip.style("opacity", 1).html(d.name);
            }
        })
        .on("mousemove", event => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .call(drag);

    nodeEnter.transition().duration(300)
        .attr("r", d => nodeRadius(d))
        .style("opacity", 1);

    node = nodeEnter.merge(node);

    /* LABELS for main nodes only */
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
        .attr("font-size", d => d.type === "disease" ? "18px" : "14px")
        .attr("font-weight", d => d.type === "disease" ? "bold" : "normal")
        .attr("text-anchor", "middle")
        .attr("dy", -40)
        .style("opacity", 0);

    labelEnter.transition().duration(300).style("opacity", 1);

    label = labelEnter.merge(label);

    sim.nodes(nodes);
    sim.alpha(1).restart();
}

/* -------------------------------------------------------
   INITIAL DRAW
------------------------------------------------------- */
restartSimulation();

/* -------------------------------------------------------
   SIMULATION TICK
   + position labels under Symptoms / Risk Factors
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

    /* Move main-node text */
    label
        .attr("x", d => d.x)
        .attr("y", d => d.y - 40);

    /* Move floating Symptoms label */
    if (symptomsTextLabel) {
        const symNode = nodes.find(n => n.name === "Symptoms");
        if (symNode) {
            symptomsTextLabel
                .attr("x", symNode.x)
                .attr("y", symNode.y + 55);
        }
    }

    /* Move floating Risk Factors label */
    if (riskTextLabel) {
        const riskNode = nodes.find(n => n.name === "Risk Factors");
        if (riskNode) {
            riskTextLabel
                .attr("x", riskNode.x)
                .attr("y", riskNode.y + 55);
        }
    }
});

