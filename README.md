# Potential Effects and Risks of Smoking 

This project is a web-page based visualizaton tool developed for the course 'Programming in the Life Sciences' at the Maastricht Science Programme. 
It explores how smoking is related to different diseases and how these relate to each others in terms of symptoms and underlying risks factors. 

# Our Research Question: 
What diseases are caused by smoking, and what similarities exist in their symptoms and underlying causes?

# Aim of the Project: 
Our goal is to make the relationship between smoking, diseases, symptoms and risks factors visible and explorable for users who are not familiar with raw data, 
by turning complex tables into intuitive visualisations that make patterns and similarities much easier to understand.

The website answers the Research Question by: 

- collecting structured data on smoking-related diseases from Wikidata. 
- visualising the diseases and their properties in several different ways. 
- allowing users to compare diseases through symptoms and risk factors.

# 2. Data and Methods 

# 2.1 Data Source
ALL the data of this project is traceable to **Wikidata**, which is a collaborative and open knowledge database. 

# 2.2 Data Collection
We use **SPARQL endpoints** to query Wikidata and retrieve:

- diseases that are associated with smoking as a risk factor  
- their symptoms
- their other risk factors

The SPARQL queries are executed from our JavaScript code. The returned data is then cleaned and transformed into the formats required for each visualisation (nodes/links for the network, aggregated counts for bar charts, and symptom frequencies for the pie chart).

# 2.3 Analysis
To answer the research question, we focus on two aspects:

1. Which diseases are linked to smoking? 
   → identified via the SPARQL queries on Wikidata.

2. How do these diseases resemble each other?  
   → measured and shown by:
   - shared symptoms  
   - shared risk factors  
   - frequency distributions of symptoms across all diseases

# 3. Structure of the website 

# 3.1 Homepage (Index.html) 

 It introduces the Research question and context of the study and briefly explain what each visualization does.
 Furthermore, it provides navigation to: 
 1. **Network Visualization**
 2. **Bar Charts**
 3. **Pie Chart**
 4. **About us**
 5. **Course Information**
 6. **Disclaimer** 

# 3.2 Network Visualization (Circles.html, network.js, disease.html, disease.js) 
Displays a **network of diseases** related to smoking.  
- Nodes represent diseases; connections represent **shared symptoms or risk factors**.  
- The user can explore underlying causes and manifestations by interacting with the nodes.

# 3.3 Bar Charts (Barcharts.html, Barcharts.js) 

 1. Bar Chart 1 – diseases per risk factor  
   - Shows, for each risk factor related to smoking, how many diseases in our dataset are associated with it.  
   - Helps identify the most common risk factors among smoking-related diseases.

2. Bar Chart 2 – symptoms per disease 
   - Shows, for each disease, how many symptoms are linked to it.  
   - Allows users to compare which diseases have a broader or narrower range of symptoms.
 
The Bar Charts together provide a comparative analysis. 

# 3.4 Pie Chart (pie.html, pie.js) 
 Shows the frequency of symptoms across all smoking-related diseases. 
 
- Each slice corresponds to one symptom; the size of the slice reflects how often this symptom appears among diseases in our dataset.  
- This helps answer which symptoms are **most characteristic** of smoking-related diseases overall.

# 3.5 Context Pages 
Here the webpage navigates to the following: 
- About us **(AboutUs.html)**- it introduces the developers.
- Course **(Course.html)**- situates the project within PRA3006
- Disclaimer **(Disclaimer.html)**- clarifies that the website is for educational purposes and it is NOT medical advice.

# 4. Future work
**Extented Comparison Visualisations**
Exploring additional comparison options, for example:
     - grouping diseases by type or severity  
     - adding filters for specific risk factors or symptom categories  
This will deepen the analysis of similarities between diseases and their underlying causes.

# 5. What we Used 
- HTML to structure the pages
- CSS for styling and layout
- JavaScript for data handling and interactivity
- D3.js for network and bar charts
- Chart.js for pie chart
- SPARQL for query WikiData

# 6. Done! Now you can try to navigate the website 
Clone the repository or download it as a ZIP:

   ```bash
   git clone https://github.com/serenalucarini/PRA3006-G1.git




