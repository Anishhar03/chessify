const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);
let chess; // Declare chess instance globally

let players = {};
let currentPlayer = "W"; // "W" for white, "B" for black

// Set view engine
app.set("view engine", "ejs");

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Serve the main page
app.get("/", (req, res) => {
    res.render("index", { title: "Chessify" });
});

// Handle socket connection
io.on("connection", (socket) => {
    console.log("A new player connected", socket.id);

    // Assign player roles (white or black)
    if (!players.white) {
        players.white = socket.id;
        socket.emit("playerRole", "w");
        console.log("Assigned White to:", socket.id);
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit("playerRole", "b");
        console.log("Assigned Black to:", socket.id);
    } else {
        socket.emit("spectatorRole"); // Other connections are spectators
        console.log("Assigned Spectator role");
    }

    // Initialize a new chess game on first connection
    if (!chess) {
        chess = new Chess(); // Create a new Chess instance
    }

    // Send the current board state when a new player or spectator joins
    socket.emit("boardState", chess.fen());

    // Handle player disconnection
    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        if (socket.id === players.white) {
            delete players.white;
        } else if (socket.id === players.black) {
            delete players.black;
        }

        // Reset game if both players disconnect
        if (!players.white && !players.black) {
            chess = null; // Reset chess instance
            console.log("Game reset due to both players disconnecting.");
        }

        console.log("Updated players:", players);
    });

    // Handle chess moves
    socket.on("move", (move) => {
        try {
            // Check turn validity
            if ((chess.turn() === "w" && socket.id !== players.white) || 
                (chess.turn() === "b" && socket.id !== players.black)) {
                return socket.emit("invalidMove", "Not your turn!");
            }

            // Make the move
            const result = chess.move(move);
            if (result) {
                io.emit("boardState", chess.fen()); // Send updated board state to all players
                console.log("Move made:", move);
            } else {
                socket.emit("invalidMove", "Move is invalid");
                console.log("Invalid move attempt:", move);
            }
        } catch (err) {
            console.error("Move error:", err);
            socket.emit("invalidMove", "Error processing move");
        }
    });
});

// Start the server
server.listen(3000, function () {
    console.log("Server is running on port 3000");
});
