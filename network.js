/////// CREATE A NETWORK FROM WIKIDATA SPARQL ENDPOINT ///////

const sparqlEndpoint = "https://query.wikidata.org/sparql"; // connect to Wikidata SPARQL endpoint
let allData = []; // variable to store all fetched data

// iterative function to convert into appropriate json format
async function convert(data) { 
    const nodes = [{ id: 1, name: "smoking", isMain: true }]; // make smoking node
    
    data.forEach((item, index) => { // make disease nodes
      nodes.push({
        id: index + 2,
        name: item.diseaseLabel.value,
        isMain: false
      });
    });

    const links = data.map((_, index) => ({ // make links from smoking to diseases
      source: 1,
      target: index + 2
    }));

    const network = { nodes, links }; // combine nodes and links into the appropriate json format
    console.log("network " + network); //print in the console what the network is
    return network;
}

// fetch data from SPARQL endpoint
async function fetchData() {
    const loadingMessage = document.getElementById("loading-message"); // makes a loading message according to css style
    loadingMessage.classList.remove("hidden"); //??? check how to use loading message properly

    // SPARQL query to get diseases caused by smoking
    const sparqlQuery = `
    SELECT ?disease ?diseaseLabel
    WHERE {
      ?disease wdt:P5642 wd:Q662860.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;

    try { // fetch data from the endpoint 
        const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(sparqlQuery)}`, {
            headers: { Accept: "application/json" }
        }); 
        // await is used to wait for the promise to resolve, code does not proceed until the function after is done
        
        const data = await response.json();
        const results = data.results.bindings; // selects the correct array from the fetched data
        console.log(results); // print in the console the results
        
        const network = await convert(results); // convert results into appropriate json format
        loadingMessage.classList.add("hidden"); //??? check how to use loading message properly
        
        return network;
    } catch (error) {
        console.error("Error fetching data:", error); // print error message in console if present
        loadingMessage.classList.add("hidden");
        return { nodes: [], links: [] }; // returns a blank array, array are defined by []
    }
}

// Initialize on page load
async function initializeNetwork() {
    const network = await fetchData();
    
    // set up network dimensions
    const headerHeight = window.innerHeight * 0.20;
    const footerHeight = window.innerHeight * 0.20;
    const width = window.innerWidth * 0.7;
    const height = window.innerHeight - headerHeight - footerHeight;

    // add nodes
    const svg = d3.select("#circle")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("margin-top", headerHeight + "px");

    // add links
        const link = svg
        .selectAll("line")
        .data(network.links)
        .enter()
        .append("line")
        .style("stroke", "#dbdbdbff");

    const tooltip = d3.select("#tooltip"); // ???? this should select the tooltip id from the css

    const node = svg.append("g")
        .selectAll("circle")
        .data(network.nodes)
        .join("circle")
        .attr("r", 15)
        .attr("fill", d => d.isMain ? "#c5c5ffff" : "#e6e6fa") // color nodes, smoking vs diseases
        .on("mouseover", (event, d) => {
            if (!d.isMain) {
                // if the mouse is over a disease node:
                d3.select(event.currentTarget)
                    .attr("fill", "#936bffff") // change colour
                    .attr("r", 20); // increase size
                tooltip.style("opacity", 1).html(d.name); // show tooltip
            }
        })
        .on("mousemove", (event) => { // move tooltip with mouse
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseout", (event, d) => { // when mouse leaves node go back to normal
            if (!d.isMain) {
                d3.select(event.currentTarget)
                    .attr("fill", "#e6e6fa")
                    .attr("r", 15);
            }
            tooltip.style("opacity", 0); // hide tooltip
        });
    
    // set up force simulation, shows the movement at the first page refresh
    const simulation = d3.forceSimulation(network.nodes)
        .force("link", d3.forceLink(network.links).id(d => d.id).distance(10)) // determines link distance
        .force("charge", d3.forceManyBody().strength(-500)) // determines repulsion between nodes
        .force("center", d3.forceCenter(width / 2, height / 2)) // centers the network in the svg area
        .alphaDecay(0.04) // controls the speed of the simulation
        .on("tick", ticked); // update positions on each "tick"

    function ticked() {
        link // updates link positions
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node // keeps nodes within svg area
            .attr("cx", d => Math.max(20, Math.min(width - 20, d.x))) 
            .attr("cy", d => Math.max(20, Math.min(height - 20, d.y))); 
    }
}

// Call initialization when page loads
document.addEventListener("DOMContentLoaded", initializeNetwork);
