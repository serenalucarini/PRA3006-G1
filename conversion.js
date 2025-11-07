import fs from "fs";

// Read the disease.json file
const data = JSON.parse(fs.readFileSync("diseases_smoking.json", "utf-8"));

// Create nodes — start with smoking
const nodes = [{ id: 1, name: "smoking" }];

// Add disease nodes
data.forEach((item, index) => {
  nodes.push({
    id: index + 2, // IDs start at 2
    name: item.diseaseLabel
  });
});

// Create links — all from smoking (id 1)
const links = data.map((_, index) => ({
  source: 1,
  target: index + 2
}));

// Combine into final network object
const network = { nodes, links };

// Write to network.json
fs.writeFileSync("network.json", JSON.stringify(network, null, 2));

console.log(`✅ Created network.json with ${data.length} diseases`);
