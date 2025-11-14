

d3.json("diseases_symptoms.json").then(rows => {
    console.log("Loaded JSON rows:", rows.length);

    // Group by diseaseLabel -> unique symptomLabels
    const diseaseToSymptoms = d3.rollup(
        rows,
        v => {
            const symptomSet = new Set(v.map(d => d.symptomLabel));
            return {
                count: symptomSet.size,
                symptoms: Array.from(symptomSet)
            };
        },
        d => d.diseaseLabel
    );

    let data = Array.from(diseaseToSymptoms, ([diseaseLabel, info]) => ({
        diseaseLabel,
        count: info.count,
        symptoms: info.symptoms
    }));

    // Sort by number of symptoms, descending
    data.sort((a, b) => b.count - a.count);

    console.log("Unique diseases:", data.length);

    const width = 900;
    const height = 600;

    const svg = d3.select("#chart-container")
        .append("svg")
            .attr("width", width)
            .attr("height", height);

    // Create hierarchy for d3.pack
    const root = d3.hierarchy({ children: data })
        .sum(d => d.count);

    const pack = d3.pack()
        .size([width, height])
        .padding(5);

    const nodes = pack(root).leaves();

    // Color scale by number of symptoms
    const countExtent = d3.extent(nodes, d => d.data.count);
    const color = d3.scaleSequential()
        .domain(countExtent)
        .interpolator(d3.interpolatePuRd);

    // Tooltip (HTML div)
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "bubble-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "8px 10px")
        .style("font-size", "12px")
        .style("max-width", "260px")
        .style("box-shadow", "0 2px 6px rgba(0,0,0,0.2)")
        .style("opacity", 0);

    const node = svg.selectAll("g.node")
        .data(nodes)
        .enter()
        .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`);

    // Circles
    node.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => color(d.data.count))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            const html = `
                <strong>${d.data.diseaseLabel}</strong><br/>
                <em>${d.data.count} symptom(s)</em><br/><br/>
                <strong>Symptoms:</strong><br/>
                ${d.data.symptoms.join(", ")}
            `;
            tooltip
                .style("opacity", 1)
                .html(html);
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        });

    // Labels inside bubbles (shortened)
    node.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("font-size", d => Math.min(12, d.r / 3))
        .text(d => {
            const label = d.data.diseaseLabel;
            return label.length > 18 ? label.slice(0, 15) + "…" : label;
        });

    // === Legend for bubble size ===
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(60,80)");

    const legendTitle = legend.append("text")
        .attr("x", 0)
        .attr("y", -40)
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .text("Bubble size = number of symptoms");

    const minCount = countExtent[0];
    const maxCount = countExtent[1];
    const midCount = Math.round((minCount + maxCount) / 2);

    const legendValues = [minCount, midCount, maxCount];

    // Radius scale ONLY for legend (approximate visual)
    const rScale = d3.scaleSqrt()
        .domain(countExtent)
        .range([8, 25]);

    const legendItem = legend.selectAll(".legend-item")
        .data(legendValues)
        .enter()
        .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 55})`);

    legendItem.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => rScale(d))
        .attr("fill", "#f2f2f2")
        .attr("stroke", "#555");

    legendItem.append("text")
        .attr("x", d => rScale(d) + 8)
        .attr("y", 4)
        .attr("font-size", 11)
        .text(d => `${d} symptom(s)`);

}).catch(err => {
    console.error("Error loading or parsing diseases_symptoms.json:", err);
});
