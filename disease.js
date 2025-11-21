//-----------------------------------------------------
// Get disease name from URL
//-----------------------------------------------------
const params = new URLSearchParams(window.location.search);
const diseaseName = params.get("name");

// Set title on the page
document.getElementById("title").textContent = diseaseName;


//-----------------------------------------------------
// SPARQL Queries
//-----------------------------------------------------

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


//-----------------------------------------------------
// Create base nodes
//-----------------------------------------------------
const nodes = [
    { name: diseaseName, type: "disease" },
    { name: "Symptoms", type: "symptoms" },
    { name: "Risk Factors", type: "risk" }
];

const links = [
    { source: diseaseName, target: "Symptoms" },
    { source: diseaseName, target: "Risk Factors" }
];

let expandedSymptoms = false;
let expandedRisks = false;


//-----------------------------------------------------
// Build SVG + Force Simulation
//-----------------------------------------------------
const width = 900;
const height = 600;

const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const linkGroup = svg.append("g");
const nodeGroup = svg.append("g");
const labelGroup = svg.append("g");

let link = linkGroup.selectAll("line");
let node = nodeGroup.selectAll("circle");
let label = labelGroup.selectAll("text");

const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.name).distance(200))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2));


//-----------------------------------------------------
// Functions to expand graph
//-----------------------------------------------------

async function expandSymptoms() {
    if (expandedSymptoms) return; 
    expandedSymptoms = true;

    const symptoms = await fetchSymptoms(diseaseName);

    symptoms.forEach(sym => {
        const obj = { name: sym, type: "symptomDetail" };
        nodes.push(obj);
        links.push({ source: "Symptoms", target: sym });
    });

    restartSimulation();
}


async function expandRiskFactors() {
    if (expandedRisks) return;
    expandedRisks = true;

    const risks = await fetchRiskFactors(diseaseName);

    risks.forEach(risk => {
        const obj = { name: risk, type: "riskDetail" };
        nodes.push(obj);
        links.push({ source: "Risk Factors", target: risk });
    });

    restartSimulation();
}


//-----------------------------------------------------
// Re-render everything after expanding
//-----------------------------------------------------

function restartSimulation() {

    // Update links
    link = linkGroup.selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#aaa");

    // Update nodes
    node = nodeGroup.selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 22)
        .attr("fill", d => {
            if (d.type === "disease") return "#457b9d";
            if (d.type === "symptoms") return "#f4a261";
            if (d.type === "risk") return "#e76f51";
            if (d.type === "symptomDetail") return "#f7b267";
            if (d.type === "riskDetail") return "#f79d65";
            return "gray";
        })
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            if (d.type === "symptoms") expandSymptoms();
            if (d.type === "risk") expandRiskFactors();
        });

    // Update labels
    label = labelGroup.selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.name)
        .attr("font-size", "13px")
        .attr("text-anchor", "middle")
        .attr("dy", 4);

    // Restart simulation
    sim.nodes(nodes);
    sim.force("link").links(links);
    sim.alpha(1).restart();
}


//-----------------------------------------------------
// Initial render
//-----------------------------------------------------
restartSimulation();

sim.on("tick", () => {
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
        .attr("y", d => d.y - 28);
});

