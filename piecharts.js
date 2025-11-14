3.json("diseases_symptoms.json").then(rows => {
    // Aggregate: symptomLabel -> number of unique diseases
    const symptomToDiseaseCount = d3.rollup(
        rows,
        v => new Set(v.map(d => d.disease)).size,
        d => d.symptomLabel
    );

    // Convert Map to array that D3 likes
    let data = Array.from(symptomToDiseaseCount, ([symptomLabel, count]) => ({
        symptomLabel,
        count
    }));

    // (optional) sort by count descending so big ones are grouped
    data.sort((a, b) => b.count - a.count);

    // === PIE CHART SETUP ===
    const width = 450;
    const height = 450;
    const radius = Math.min(width, height) / 2 - 10;

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.symptomLabel))
        .range(d3.schemeCategory10);

    const svg = d3.select("#chart-container")
        .append("svg")
            .attr("width", width)
            .attr("height", height)
        .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie()
        .value(d => d.count)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)        // >0 would make a donut chart
        .outerRadius(radius);

    const labelArc = d3.arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius * 0.7);

    const arcs = svg.selectAll("path")
        .data(pie(data))
        .enter()
        .append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.symptomLabel))
            .attr("stroke", "white")
            .attr("stroke-width", 1);

    // Labels: symptom (count)
    svg.selectAll("text")
        .data(pie(data))
        .enter()
        .append("text")
            .attr("transform", d => `translate(${labelArc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .text(d => `${d.data.symptomLabel} (${d.data.count})`);
}).catch(error => {
    console.error("Error loading diseases_symptoms.json:", error);
});
