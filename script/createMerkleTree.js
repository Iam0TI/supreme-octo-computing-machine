const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");
const { values } = require("./airdrop_list");

const tree = StandardMerkleTree.of(values, ["address", "uint256", "uint256"]);

console.log("Merkle Root:", tree.root);

fs.writeFileSync("tree.json", JSON.stringify(tree.dump(), null, 2), "utf8");

console.log("JSON file created: tree.json");
