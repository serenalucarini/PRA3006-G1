// Load a JSON file 
async function loadJSON(file) {
  const response = await fetch(file);
  const data = await response.json();
  return data; 
}

// Main function to display data
async function displayData() {
  try {
    // Load the three JSON files
    const diseases = await loadJSON("diseases_smoking.json");
    const riskFactors = await loadJSON("diseases_risk_factors.json");
    const symptoms = await loadJSON("diseases_symptoms.json");

    // Container for output
    const container = document.getElementById("output");
    container.innerHTML = "";

    // Loop through each disease
    diseases.forEach(disease => {
      const diseaseLabel = disease.label || disease.disease;

      // Create disease header
      const diseaseHeader = document.createElement("h2");
      diseaseHeader.textContent = diseaseLabel;
      container.appendChild(diseaseHeader);

      // Find risk factors for this disease
      const factors = riskFactors
        .filter(rf => rf.disease === diseaseLabel || rf.disease === disease.disease)
        .map(rf => rf.factorLabel || rf.factor);

      if (factors.length > 0) {
        const rfList = document.createElement("p");
        rfList.innerHTML = `<strong>Risk Factors:</strong> ${factors.join(", ")}`;
        container.appendChild(rfList);
      }

      // Find symptoms for this disease
      const diseaseSymptoms = symptoms
        .filter(s => s.disease === diseaseLabel || s.disease === disease.disease)
        .map(s => s.symptomLabel || s.symptom);

      if (diseaseSymptoms.length > 0) {
        const symptomList = document.createElement("p");
        symptomList.innerHTML = `<strong>Symptoms:</strong> ${diseaseSymptoms.join(", ")}`;
        container.appendChild(symptomList);
      }

      // Horizontal line between diseases
      container.appendChild(document.createElement("hr"));
    });

  } catch (error) {
    console.error("Error loading JSON data:", error);
    document.getElementById("output").textContent = "Error loading data.";
  }
}

// Call main function when the page loads
window.onload = displayData;
