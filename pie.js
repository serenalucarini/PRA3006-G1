// Fetch data from SPARQL endpoint
async function fetchData(query) {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
    const headers = { 'Accept': 'application/json' }; //json: format needed for js.

    try { //handle errors, if all fine it runs
        document.getElementById('loading').style.display = 'block'; // Show loading indicator while wait for data
        const response = await fetch(url, { headers }); // resp. is the data we get
        const data = await response.json(); //converts resp. into json format for programm to read -> data
        document.getElementById('loading').style.display = 'none'; // Hide loading indicator because data is present
        return data.results.bindings; //extract & return data from query
    } catch (error) { //runs if sth goes wrong
        document.getElementById('loading').style.display = 'none'; // Hide loading indicator
        console.error("Error fetching data:", error); //says error in console for developer to see
        return []; // returns empty array so rest of program doesn't brake
    }
}
//Summary of What Happens
//    1.	The function starts by preparing a URL with a SPARQL query.
//	2.	Shows a loading indicator while waiting for the data.
//	3.	Fetches data from Wikidata and parses it into JSON.
//	4.	Hides the loading indicator once the data is retrieved.
//	5.	Returns the results if successful.
//	6.	Logs an error and returns an empty array if something goes wrong.

// Fetch continent-level data
async function getContinentData() { //define function
    //const. query value will be constant
    const query = `  
    SELECT ?continentLabel (COUNT(?species) AS ?speciesCount) WHERE {
        ?species wdt:P31 wd:Q16521; 
                 wdt:P141 wd:Q96377276;
                 wdt:P105 wd:Q7432;
                 wdt:P183 ?country.
        ?country wdt:P30 ?continent.
        SERVICE wikibase:label {
            bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
        }
    }
    GROUP BY ?continentLabel
    ORDER BY DESC(?speciesCount)
    `;
    const data = await fetchData(query); //runs sparql & waits for result using fetchdata , await pauses function until data retrieved from server
    return data.map(item => ({  //converts data into simpler form, each result transormed into object with two keys: label(name of cont.)&value(nbr. of species)
        label: item.continentLabel.value,
        value: parseInt(item.speciesCount.value, 10),//parseInt: converts string into integer
    }));
}
//Summary of What Happens

//	1.	The function prepares a query to count species by continent.
//	2.	It sends the query to a database (like Wikidata).
//	3.	It waits for the results.
//	4.	It formats the results into a list of objects:
//	•	Example: { label: "Africa", value: 5000 }.


// Fetch country-level data for a specific continent
async function getCountryData(continentLabel) { //continentLabel: string e.g "Africa"
    const query = `
    SELECT ?countryLabel (COUNT(?species) AS ?speciesCount) WHERE { 
        ?species wdt:P31 wd:Q16521;
                 wdt:P141 wd:Q96377276;
                 wdt:P105 wd:Q7432;
                 wdt:P183 ?country.
        ?country wdt:P30 ?continent.
        ?continent rdfs:label "${continentLabel}"@en.
        SERVICE wikibase:label {
            bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
        }
    }
    GROUP BY ?countryLabel
    ORDER BY DESC(?speciesCount)
    `;
    const data = await fetchData(query); //fetchdata runs query, await pauses function until data found
    if (data.length === 0) {
        alert(`No data found for continent: ${continentLabel}`);
    } //if there is no data for a continent, the alert will be shown
    return data.map(item => ({
        label: item.countryLabel.value, // name of country
        value: parseInt(item.speciesCount.value, 10), //put string into integer, number of species
    }));
}
//	1.	Input: You give the function a continent name like "Africa".
//	2.	The function builds a SPARQL query to get countries in that continent and counts the species in each country.
//	3.	Shows an alert if no data is found.
//	4.	Returns a list of countries with their species count, formatted like this:


// Fetch endangered species data for a specific country
async function getSpeciesData(countryLabel) {
    const query = `
    SELECT ?speciesLabel WHERE {
        ?species wdt:P31 wd:Q16521;
                 wdt:P141 wd:Q96377276;
                 wdt:P105 wd:Q7432;
                 wdt:P183 ?country.
        ?country rdfs:label "${countryLabel}"@en.
        SERVICE wikibase:label {
            bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
        }
    }
    ORDER BY ?speciesLabel
    `;
    const data = await fetchData(query);
    if (data.length === 0) {
        alert(`No data found for country: ${countryLabel}`);
    }
    return data.map(item => item.speciesLabel.value);
}

// Create and display a pie chart
async function createChart(chartData, chartTitle, onClickCallback) { // 3 variables: data, title of chart, function that runs when user clicks section of chart
    const chartContainer = document.querySelector('.chart-container'); // selects html element with class chart-container
    chartContainer.innerHTML = '<canvas id="endangeredSpeciesChart"></canvas>'; // Reset canvas, ensures old chart cleared before drawing new one
    const ctx = document.getElementById('endangeredSpeciesChart').getContext('2d'); //document.get.. selects the newly created canvas, getcontext(2d) sets up drawing context that chart.js needs to render chart

    return new Chart(ctx, { //creates new chart using canvas context(ctx)
        type: 'pie', 
        data: {
            labels: chartData.map(item => item.label), //labels represent each segment of chart, chartdata.map goes through data and extracts the label from each object
            datasets: [{  //actual numerical information the chart will visualize
                label: chartTitle, //title for dataset, will be displayed in chart legend
                data: chartData.map(item => item.value), //extracts value of data(number of species), represents how much each slice should occupy
               
                backgroundColor: [ 
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ],
                borderColor: [  //color of chart border//
                    'black'
                ],
                borderWidth: 2,
                hoverOffset: 4, 
            }]
        },
        options: {
            responsive: true, //makes chart resize when screen size changes
            plugins: { //add extra features like legends and tooltips
                legend: {
                    position: 'top',
                    labels: {           //style of labels//
                        color : [
                            'white',
                        ],
                        font:{
                            size:18,
                            weight: 'bold'
                            
                        }
                    }
                    
                },
                tooltip: { // box appearing when hoverung over a chart
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0); //total number of species by summing all the values (values= species)
                            const percentage = ((context.raw / total) * 100).toFixed(2); //percentage for the current slice, tofixed(2)(to 2 decimal places)
                            return `${context.label}: ${context.raw} species (${percentage}%)`; //returns string showing label, value, percentage
                            
                        }
                    }
                }
            },
            onClick: async function(event, elements) { // runs when user clicks
                if (elements.length > 0) { //checks if element of chart got clicked, if not, nothing happens
                    const clickedIndex = elements[0].index; //finds index of clicked slice
                    const clickedLabel = chartData[clickedIndex].label; //retrieves label of clicked slice
                    if (onClickCallback) { //checks if onclickcallback is defined
                        onClickCallback(clickedLabel); //defines the parameter as the one cicked
                    }
                }
            }
        }
    });
}

// Display a list of endangered species for a specific country
async function createList(speciesData, countryLabel, goBackCallback) {
    const chartContainer = document.querySelector('.chart-container'); //selects html element with class chat-container(holds the list of species) needed to display on page
    chartContainer.innerHTML = ''; // Clear existing content, prevents old data from showing when generating new list

    const title = document.createElement('h2'); //creates html h2 element used for title
    title.textContent = `Endangered Species in ${countryLabel}`; // text content of title depending on countrylabel
    chartContainer.appendChild(title); //adds title to chart-container

    const ul = document.createElement('ul'); //ul:unordered list which will hold the species names

    speciesData
        .map(species => capitalizeSpeciesName(species)) //creates new array where each species name is capitalized using the function
        .sort() //sort in alphabetic order
        .forEach(species => { //loops over sortd+capitalized species, creating a <li> element for each species
            const li = document.createElement('li'); //creates new list item for eaxh species
            li.textContent = species; //sets content of list to species name
            li.style.cursor = 'pointer';//cahnges cursor to pointer when hovering ver species name, indicating it's clickable
            li.addEventListener('click', () => showWikipediaPreview(species)); //adds click event listener to each list item. When user clicks on species, triggers showWikipediaPrevi function, whih shows wikipedia page of species
            ul.appendChild(li); //appends newly created list to ul
        });

    chartContainer.appendChild(ul); //appends whole ul to chartcontainer, ensures list appears on page

    const backButton = document.createElement('button'); //creates html button element
    backButton.textContent = 'Back to Country Chart'; //sets text on button
    backButton.onclick = () => goBackCallback(); //when button is clicked, it calls gobackcallback function. Which is then passed to createlist function as a parameter
    chartContainer.appendChild(backButton); //adds button to chartcontainer, making it visible on the page
}

//Summary of the createList Function:

//	1.	Clears old content from the chart container.
//	2.	Creates a title with the country name.
//	3.	Generates a sorted list of species names, with each name clickable.
//	4.	Displays a “Back to Country Chart” button, allowing the user to go back to the previous view when clicked.



// Capitalizes the first letter of a species name
function capitalizeSpeciesName(name) { //takes single argument
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : name; //name ?: checks if it is not an empty string (if empty,just returns the name as it is), name.charAt(0).toUpperCase(): gets first character of string & converts it to uppercase, name.slice(1): takes rest of string starting from second character
}

// Show Wikipedia page for a species
function showWikipediaPage(species) { //
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(species)}`; //links to wikipedi page of species, encodeurlcomponent converts special character like space into their url-encoded format
    window.open(url, '_blank'); //built in javascript function to open browser in new tab, opens url we created, 'blank' opens it in a new tab
}

// Initialize charts with multi-level navigation
async function initializeCharts() { //async because need to wait e.g fetching data
    const continentData = await getContinentData(); //calls function to get data, await to pause execution of function until getcontinentdata returns data

    if (continentData.length === 0) { //checks if array is empty, if data was returned
        alert("No data available.");
        return; //if there is no data, no chart will be created
    }

    await createChart( //if continetData is not empty, it calls createchart function to create chart
        continentData,
        'Endangered Species per Continent', //chart will show nbr of endangered secies per continent
        async (continentLabel) => { //uses the continentlabel(name of continent clicked) as an argument
            const countryData = await getCountryData(continentLabel); //calls getcountrydata with continentlabel to get data about endangered species in countries within clicked continent
            if (countryData.length === 0) return; // checks if there is data for the countries in clicked continent, if no data, simply returns and does not continue to next step

            await createChart( //if valid countrydata, creates new chart with that data
                countryData,
                `Endangered Species in ${continentLabel}`, //chart will show nbr of endangerd species per country
                async (countryLabel) => { //uses the countrylabel(name of country clicked) as an argument
                    const speciesData = await getSpeciesData(countryLabel); // calls getspeciesdata with the clicked on country as an argument , await because function waits for data before continuing
                    if (speciesData.length === 0) return; //checks if speciesdata is empty, if yes it simply returns

                    await createList(speciesData, countryLabel, () => initializeCharts()); //if valid speciesdata, it calls createList function to generate list of species for clicked country
                } // () = function when butoon gets pressed added at the buttom
            );
        }
    );
}

// Show Wikipedia data in the modal
async function showWikipediaPreview(species) { //takes summary of species from wikipedia and displays it in modal window
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(species)}`; //${} puts element into string element
    try { //handles errors that may occur during API request
        // Fetch summary data from Wikipedia's API ,API:set of rule&protocols that allows software applications to communicate&interact
        const response = await fetch(url); //request to url and waits for response
        const data = await response.json(); //converts json response from wikipedia into js object

        // Check if a valid summary was returned
        if (data.extract) { //checks for valid summary(extract)
            //define modalbody to be the box where text comes
            document.getElementById('modalBody').innerHTML = ` 
                <h3>${data.title}</h3> 
                <p>${data.extract}</p>
                <a href="${data.content_urls.desktop.page}" target="_blank">Read more on Wikipedia</a>
            `;
        } else {
            document.getElementById('modalBody').innerHTML = '<p>No information available for this species.</p>';
        }

        // Display the modal
        document.getElementById('speciesModal').style.display = 'flex'; //makes modal visible over the page
    } catch (error) { //if API request had any errors
        console.error("Error fetching Wikipedia data:", error); //shows error in console for debugging
        alert('Could not load data from Wikipedia.'); //shows the user data could not be fetched
    }
}

// Close the modal
function closeModal() {
    document.getElementById('speciesModal').style.display = 'none'; //hides modal by setting display to none
}


// Initialize the app when the page loads
initializeCharts();
