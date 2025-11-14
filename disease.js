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

    const diseaseSymptoms = symptoms
        .filter(s => s.disease === diseaseName)
        .map(s => ({ name: s.symptomLabel || s.symptom }));

    const diseaseRisks = risks
        .filter(r => r.disease === diseaseName)
        .map(r => ({ name: r.factorLabel || r.factor }));

    const root = { name: diseaseName, type: "disease" };
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

    const addChildren = (parent, items, type) => {
        items.forEach(i => {
            i.type = type;
            nodes.push(i);
            links.push({ source: parent, target: i });
        });
    };

    // clicking category nodes expands children
    function expandNode(event, d) {
        if (d.name === "Symptoms") {
            addChildren(d, diseaseSymptoms, "symptom");
        }
        if (d.name === "Risk Factors") {
            addChildren(d, diseaseRisks, "riskFactor");
        }
        update();
    }

    const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).distance(150).id(n => n.name))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width/2, height/2));

    const linkGroup = svg.append("g");
    const nodeGroup = svg.append("g");
    const labelGroup = svg.append("g");

    function update() {
        const link = linkGroup.selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#aaa");

        const node = nodeGroup.selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", 20)
            .attr("fill", d => ({
                disease: "steelblue",
                category: "orange",
                symptom: "green",
                riskFactor: "purple"
            }[d.type]))
            .on("click", expandNode);

        const label = labelGroup.selectAll("text")
            .data(nodes)
            .join("text")
            .attr("text-anchor","middle")
            .attr("dy",5)
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
