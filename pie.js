// Sparql query to get diseases caused by smoking and their symptoms
const sparqlQuery = `
        SELECT ?disease ?diseaseLabel ?factor ?factorLabel ?symptoms ?symptomsLabel
        WHERE {
            ?disease wdt:P5642 wd:Q662860.
            ?disease wdt:P780 ?symptoms.
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en". } 
        }`;

const endpointUrl = 'https://query.wikidata.org/sparql'; // Wikidata SPARQL endpoint
const statusEl = document.getElementById('status'); // This will be the message element, showing status updates

// get the context so that the Chart.js library knows where to draw the pie chart and how to render it
const ctx = document.getElementById('pieChart').getContext('2d');
let currentChart = null; // variable to hold the current chart

function generateColors(n) { // Generate an array of pastel colors
    const colors = [];
    for (let i = 0; i < n; i++) {
    const hue = Math.floor((i * 137.508) % 360); 
    // uses golden angle approximation so that neighbouring slices have different colors
    // ensures maximum color contrast instead of being equally spaced
    colors.push(`hsl(${hue}, 65%, 70%)`); // select pastel colors
    }
    return colors;
}

async function fetchSparql(query) { // fetch data from the SPARQL endpoint
    const url = endpointUrl + '?query=' + encodeURIComponent(query); // converts the query into a URL-encoded format
    const res = await fetch(url, { // await for the promise to resolve
    headers: { 'Accept': 'application/sparql-results+json' }
    });
    if (!res.ok) {
    throw new Error('SPARQL request failed: ' + res.status + ' ' + res.statusText);
    }
    return res.json();
}

function aggregateBySymptom(bindings) { // count distinct diseases per symptom
    const map = new Map(); // Map to hold symptom and its set of diseases

    for (const row of bindings) { 
    // symptom labels (or backup to symptom value if no label)
    const symptomLabel = (row.symptomsLabel && row.symptomsLabel.value) ||
                            (row.symptoms && row.symptoms.value) || 'unknown';
    // disease URIs (or backup to disease value if no label)
    const diseaseUri = (row.disease && row.disease.value) || (row.diseaseLabel && row.diseaseLabel.value) || 'unknown';

    if (!map.has(symptomLabel)) map.set(symptomLabel, new Set()); // initialize set if not present
    map.get(symptomLabel).add(diseaseUri); // add disease to the set for this symptom
    }

    // convert map to array and sort by count of diseases, descending
    const items = [];
    for (const [symptom, diseaseSet] of map.entries()) {
    items.push({ symptom, count: diseaseSet.size });
    }
    items.sort((a, b) => b.count - a.count);
    return items;
}

async function draw() { // main function to draw the pie chart
    // for each step it shows (through the status update) error messages if something goes wrong 
    try {
    statusEl.textContent = 'Fetching data from Wikidata...';
    const data = await fetchSparql(sparqlQuery);

    const bindings = (data && data.results && data.results.bindings) || [];
    if (bindings.length === 0) {
        statusEl.textContent = 'No results returned by the SPARQL query.';
        return;
    }

    statusEl.textContent = `Processing ${bindings.length} rows...`;;
    const aggregated = aggregateBySymptom(bindings);

    if (aggregated.length === 0) {
        statusEl.textContent = 'No symptom groups found after aggregation.';
        return;
    }

    const labels = aggregated.map(x => x.symptom);
    const counts = aggregated.map(x => x.count);
    const colors = generateColors(labels.length);

    // Destroy previous chart if present
    if (currentChart) currentChart.destroy();

    // Create new pie chart
    currentChart = new Chart(ctx, {
        type: 'pie',
        data: {
        labels: labels,
        datasets: [{
            data: counts,
            backgroundColor: colors,
            borderColor: '#fff',
            borderWidth: 1
        }]
        },
        options: { // adds legend, tooltip and title to the pie chart
        plugins: { 
            legend: {
            position: 'right', // position of the legend
            labels: { boxWidth: 12, padding: 8 } // size and padding of the legend box
            },
            tooltip: { // defines the tooltip
            callbacks: { // customizes the tooltip content
                label: function(context) { // format the tooltip label
                const label = context.label || ''; // get the label of the slice
                const value = context.parsed || 0; // get the value of the slice
                // shows label and value when hovering over a slice
                return label + ': ' + value + ' disease' + (value !== 1 ? 's' : ''); // pluralize 'disease' if needed
                }
            }
            },
            title: { 
            display: false, // no title is displayed for the chart
            }
        },
        responsive: true, // make the chart responsive-interactive
        maintainAspectRatio: false // fills the space available, unless specifies otherwise in the CSS
        }
    });

    statusEl.textContent = ''; // clears the status message

    } catch (err) { // catches any error that may occurs during the process
    console.error(err); // log the error to the console for debugging
    statusEl.innerHTML = 'Error: ' + err.message + ' <button id="retry">Retry</button>'; // show error message (through status update) with a retry button
    document.getElementById('retry').addEventListener('click', () => { // checks when the retry button is clicked
        statusEl.textContent = 'Retrying...';
        draw();
    });
    }
}

draw(); // call the draw function to render the pie chart
