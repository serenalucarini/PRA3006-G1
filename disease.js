async function loadJSON(file) {
    const res = await fetch(file);
    return res.json();
}

function getQueryParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("name");
}

async function renderDiseasePage() {
    const diseaseName = getQueryParam();
    document.getElementById("title").textContent = diseaseName;

    const symptoms = await loadJSON("diseases_symptoms.json");
    const risks = await loadJSON("diseases_risk_factors.json");

    // Match by exact disease name
    const diseaseSymptoms = symptoms
        .filter(s => s.disease === diseaseName)
        .map(s => ({ name: s.symptomLabel || s.symptom, type: "symptom" }));

    const diseaseRisks = risks
        .filter(r => r.disease === diseaseName)
        .map(r => ({ name: r.factorLabel || r.factor, type: "riskFactor" }));

    const root = { name: diseaseName, type: "disease", fx: 450, fy: 350 };
    const symCat = { name: "Symptoms", type: "category" };
    const riskCat = { name: "Risk Factors", type: "category" };

    const width = 900, height = 700;
    const svg = d3.select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    let nodes = [root, symCat, riskCat];
    let links = [
        { source: root, target: symCat },
        { source: root, target: riskCat }
    ];

    // Track which categories have been expanded
    let expanded = {
        symptoms: false,
        risks: false
    };

    function expandNode(event, d) {
    console.log("CLICKED:", d);

    const name = d.name.trim();

    // Expand Symptoms
    if (d.type === "category" && name === "Symptoms" && !expanded.symptoms) {
        console.log("EXPANDING SYMPTOMS");
        diseaseSymptoms.forEach(s => {
            nodes.push(s);
            links.push({ source: d, target: s });
        });
        expanded.symptoms = true;
        update();
        return;
    }

    // Expand Risk Factors
    if (d.type === "category" && name === "Risk Factors" && !expanded.risks) {
        console.log("EXPANDING RISK FACTORS");
        diseaseRisks.forEach(r => {
            nodes.push(r);
            links.push({ source: d, target: r });
        });
        expanded.risks = true;
        update();
        return;
    }

    // Symptom page
    if (d.type === "symptom") {
        window.location.href =
            "symptom.html?name=" + encodeURIComponent(d.name);
        return;
    }

    // Risk factor page
    if (d.type === "riskFactor") {
        window.location.href =
            "riskfactor.html?name=" + encodeURIComponent(d.name);
        return;
    }
        update();
 }

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).distance(150).id(n => n.name))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const linkGroup = svg.append("g");
    const nodeGroup = svg.append("g");
    const labelGroup = svg.append("g");

    function update() {
        const link = linkGroup.selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#aaa");

        const node = nodeGroup.selectAll("circle")
            .data(nodes, d => d.name)
            .join(
                enter => enter.append("circle")
                    .attr("r", 20)
                    .attr("fill", d => ({
                         disease: "steelblue",
                         category: "orange",
                         symptom: "green",
                         riskFactor: "purple"
                    }[d.type]))
                    .style("cursor", "pointer")
                    .on("click", expandNode),
                update => update
                    .style("cursor", "pointer")
                    .on("click", expandNode),
                exit => exit.remove()
            );

        const label = labelGroup.selectAll("text")
            .data(nodes)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dy", 5)
            .style("font-size", "12px")
            .text(d => d.name);

        sim.nodes(nodes).on("tick", () => {
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label.attr("x", d => d.x)
                 .attr("y", d => d.y);
        });

        sim.force("link").links(links);
        sim.alpha(1).restart();
    }

    update();
}

window.onload = renderDiseasePage;


