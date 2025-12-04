// Get disease name from URL 
const params = new URLSearchParams(window.location.search); // Parse URL parameters (e.g., ?name=Asthma)
const diseaseName = params.get("name") || "Unknown disease"; // Get "name" parameter or default to fallback text
document.getElementById("headerDiseaseName").textContent = diseaseName; // Put the disease name into the page header

// SPARQL Queries 
async function fetchSymptoms(diseaseName) { // Get symptoms for this specific disease from Wikidata
    // Get all symptoms (P780) for disease with this label 
    const query = `
    SELECT ?symptomLabel WHERE {
      ?disease rdfs:label "${diseaseName}"@en.
      ?disease wdt:P780 ?symptom.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;
    const res = await fetch(    // Send query to Wikidata endpoint
        "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query),
        { headers: { "Accept": "application/sparql-results+json" } }
    );
    const data = await res.json();   // Convert SPARQL results to JSON
    return data.results.bindings.map(b => b.symptomLabel.value);   // Extract just the symptom labels
}
async function fetchRiskFactors(diseaseName) {   // Get risk factors for the disease (P5642)
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
    return data.results.bindings.map(b => b.factorLabel.value);   // Extract risk factor labels
}

// Base Nodes + Links
let nodes = [   // Starting nodes: the main disease + two expandable categories
    { name: diseaseName, type: "disease" },
    { name: "Symptoms", type: "symptoms" },
    { name: "Risk Factors", type: "risk" }
];

let links = [      // Default links: disease - symptoms and disease - risk factors
    { source: diseaseName, target: "Symptoms" },
    { source: diseaseName, target: "Risk Factors" }
];
// Track expansion rate
let expandedSymptoms = false;
let expandedRisks = false;

// If "no symptoms available" or "no risks" text - keep reference
let symptomsTextLabel = null;
let riskTextLabel = null;

// SVG + Groups
// Full-page force-directed graph
const width = window.innerWidth;   
const height = window.innerHeight;

// Create SVG container
const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("overflow", "visible");

// Subgroups: links, nodes, and labels
const linkGroup = svg.append("g");
const nodeGroup = svg.append("g");
const labelGroup = svg.append("g");

// Force Simulation
const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.name).distance(200))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(35));

// Visual Settings
// Node sizes
function nodeRadius(d) {
    if (d.type === "disease") return 45;
    if (d.type === "symptoms" || d.type === "risk") return 35;
    return 22; // children
}
// Node colors by category 
function nodeColor(d) {
    if (d.type === "disease") return "#7393B3";
    if (d.type === "symptoms") return "#00008B";
    if (d.type === "risk") return "#5D3FD3";
    if (d.type === "symptomDetail") return "#CCCCFF"; // symptoms
    if (d.type === "riskDetail") return "#008080"; // risk factors
    if (d.type === "noSymptoms" || d.type === "noRisks") return "#bfbfbf";
    return "gray";
}

// Drag behaviour
const drag = d3.drag()
    .on("start", (event, d) => {
       // Increase simulation energy when dragging begins
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; // Fix position to cursor
        d.fy = d.y;
    })
    .on("drag", (event, d) => {
        d.fx = event.x; // Node follows the mouse
        d.fy = event.y;
    })
    .on("end", (event, d) => {
        // Release fixed position 
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    });

// Remove children of parent
function collapseChildren(parentLabel) {
    // Get names of all nodes whose parent = this node
    const childNames = nodes
        .filter(n => n.parent === parentLabel)
        .map(n => n.name);
    // Remove child nodes
    nodes = nodes.filter(n => n.parent !== parentLabel);
    // Remove links involving children
    links = links.filter(l => {
        const s = typeof l.source === "string" ? l.source : l.source.name;
        const t = typeof l.target === "string" ? l.target : l.target.name;
        return !childNames.includes(s) && !childNames.includes(t);
    });
}

// TOGGLE SYMPTOMS
async function toggleSymptoms() {
    // If already expanded, be able to collapse
    if (expandedSymptoms) {
        expandedSymptoms = false;
        collapseChildren("Symptoms");
        // Remove "no symptoms available" text if present
        if (symptomsTextLabel) {
            symptomsTextLabel.remove();
            symptomsTextLabel = null;
        }
        restartSimulation();
        return;
    }

    // Otherwise expand
    expandedSymptoms = true;
    const symptoms = await fetchSymptoms(diseaseName);
    // If no symptoms exist, show label "no symptoms available"
    if (symptoms.length === 0) {
        const symNode = nodes.find(n => n.name === "Symptoms");
        
        symptomsTextLabel = labelGroup.append("text")
            .text("No symptoms available")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .style("fill", "#444")
            .attr("x", symNode?.x || 0)
            .attr("y", (symNode?.y || 0) + 50) // below the Symptoms node
            .style("opacity", 0);
        symptomsTextLabel.transition().duration(250).style("opacity", 1);

    } else {
        // Otherwise add nodes for each symptom
        symptoms.forEach(sym => {
            nodes.push({ name: sym, type: "symptomDetail", parent: "Symptoms" });
            links.push({ source: "Symptoms", target: sym });
        });
    }
    restartSimulation();
}

// TOGGLE RISK FACTORS
async function toggleRiskFactors() {
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

// RENDER
function restartSimulation() {
    // Update link force with new links
    sim.force("link").links(links);
    // Links
    link = linkGroup.selectAll("line")
        .data(links, d => (d.source.name ?? d.source) + "->" + (d.target.name ?? d.target));
    link.exit().remove();
    const linkEnter = link.enter()
        .append("line")
        .attr("stroke", "#ccc")
        .attr("stroke-opacity", 0);

    linkEnter.transition().duration(300).attr("stroke-opacity", 1);
    link = linkEnter.merge(link);

    // NODES
    node = nodeGroup.selectAll("circle")
        .data(nodes, d => d.name);
    // Remove disappearing nodes
    node.exit()
        .transition().duration(200)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();
    // New nodes
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

    // Main labels
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

    // CHILD LABELS — always above child nodes
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

// INITIAL DRAW 
restartSimulation();

// SIMULATION TICK: move elements every frame
sim.on("tick", () => {
    
    // Move links
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    
    // Move node cirlces
    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    // Position main labels above/below
    labelGroup.selectAll("text.mainlabel")
        .attr("x", d => d.x)
        .attr("y", d =>
            d.type === "disease"
                ? d.y + nodeRadius(d) + 20      // disease name below
                : d.y - nodeRadius(d) - 20      // symptoms & risk above
        );

    // "No symptoms" text follows the Symptoms node
    if (symptomsTextLabel) {
        const symNode = nodes.find(n => n.name === "Symptoms");
        if (symNode) {
            symptomsTextLabel
                .attr("x", symNode.x)
                .attr("y", symNode.y + nodeRadius(symNode) + 20);
        }
    }

    // "No risk factors" text follows Risk Factors node
    if (riskTextLabel) {
        const riskNode = nodes.find(n => n.name === "Risk Factors");
        if (riskNode) {
            riskTextLabel
                .attr("x", riskNode.x)
                .attr("y", riskNode.y + nodeRadius(riskNode) + 20);
        }
    }

    // CHILD LABELS ABOVE EACH CHILD NODE
    labelGroup.selectAll("text.childLabel")
        .attr("x", d => d.x)
        .attr("y", d => d.y - nodeRadius(d) - 10);
});

