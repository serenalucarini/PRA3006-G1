

d3.json("diseases_symptoms.json").then(rows => {
    console.log("Loaded JSON rows:", rows.length);

    // Group by diseaseLabel and count UNIQUE symptoms
    const diseaseToSymptoms = d3.rollup(
        rows,
        v => new Set(v.map(d => d.symptom)).size,
        d => d.diseaseLabel
    );

    let data = Array.from(diseaseToSymptoms, ([diseaseLabel, count]) => ({
        diseaseLabel,
        count
    }));

    // Sort so biggest diseases are first (optional)
    data.sort((a, b) => b.count - a.count);

    console.log("Unique diseases:", data.length);

    const width = 900;
    const height = 600;

    const svg = d3.select("#chart-container")
        .append("svg")
            .attr("width", width)
            .attr("height", height);

    // Wrap data in a hierarchy so d3.pack can compute bubble layout
    const root = d3.hierarchy({ children: data })
        .sum(d => d.count);

    const pack = d3.pack()
        .size([width, height])
        .padding(5);

    const nodes = pack(root).leaves();

    // Color scale by count (number of symptoms)
    const countExtent = d3.extent(nodes, d => d.data.count);
    const color = d3.scaleSequential()
        .domain(countExtent)
        .interpolator(d3.interpolatePuRd);  // just a nice gradient

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
        .append("title") // tooltip with exact numbers
        .text(d => `${d.data.diseaseLabel}: ${d.data.count} symptom(s)`);

    // Labels (shortened if too long)
    node.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("font-size", d => Math.min(12, d.r / 3))
        .text(d => {
            const label = d.data.diseaseLabel;
            return label.length > 18 ? label.slice(0, 15) + "…" : label;
        });
}).catch(err => {
    console.error("Error loading or parsing diseases_symptoms.json:", err);
});
