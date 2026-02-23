const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');

const BOARD_FILE = 'board.svg';
const FULL_PATH_BOARD = `./tictactoe/${BOARD_FILE}`;

class TicTacToe {
  constructor(svgData) {
    this.board = [
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];
    this.svgData = svgData;
    this.parseBoardFromSVG();
  }

  parseBoardFromSVG() {
    // A very simple parse to find out where X and O are based on SVG elements
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const xPos = 10 + c * 96;
        const yPos = 10 + r * 96;
        const cx = xPos + 43;
        const cy = yPos + 43;
        
        // Check for X marker
        if (this.svgData.includes(`d="M${xPos + 20},${yPos + 20} L${xPos + 66},${yPos + 66} M${xPos + 66},${yPos + 20} L${xPos + 20},${yPos + 66}" class="mark-x"`)) {
          this.board[r][c] = 'X';
        }
        // Check for O marker
        else if (this.svgData.includes(`cx="${cx}" cy="${cy}" r="23" class="mark-o"`)) {
          this.board[r][c] = 'O';
        }
      }
    }
  }

  isGameOver() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    
    // Flat board representation
    const flat = this.board.flat();
    
    for (const [a, b, c] of lines) {
      if (flat[a] && flat[a] === flat[b] && flat[a] === flat[c]) return flat[a]; // return winner
    }
    
    if (!flat.includes('')) return 'Tie';
    return false;
  }

  makeMove(r, c, player) {
    if (this.board[r][c] !== '') return false;
    this.board[r][c] = player;
    return true;
  }

  getBestMoveForO() {
    // Simple random move logic for now, easily upgraded to minimax
    const emptyCells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.board[r][c] === '') emptyCells.push({r, c});
      }
    }
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  generateSVG() {
    let resultSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <style>
    .cell { fill: #1e1e1e; stroke: #3a3a3a; stroke-width: 4px; transition: fill 0.2s ease; cursor: pointer; }
    .cell:hover { fill: #2a2a2a; }
    .mark-x { fill: none; stroke: #61dafb; stroke-width: 8px; stroke-linecap: round; }
    .mark-o { fill: none; stroke: #ff6b6b; stroke-width: 8px; stroke-linecap: round; }
    .bg { fill: #0d1117; }
    .text { fill: #fff; font-family: sans-serif; font-size: 24px; text-anchor: middle; font-weight: bold;}
    .restart { fill: #238636; stroke: none; cursor: pointer;}
    .restart:hover { fill: #2ea043; }
  </style>
  <rect class="bg" width="300" height="300" rx="15" />\n\n`;

    const gameOver = this.isGameOver();

    if (gameOver) {
      const message = gameOver === 'Tie' ? "It's a Tie!" : `Winner: ${gameOver}`;
      resultSVG += `  <text x="150" y="130" class="text">${message}</text>\n`;
      resultSVG += `  <a href="https://github.com/imsinghaditya07/imsinghaditya07/issues/new?title=ttt%7Creset&amp;body=Reset+Game"><rect class="restart" x="80" y="160" width="140" height="40" rx="6" /><text x="150" y="188" class="text" style="font-size: 18px;">Play Again</text></a>\n`;
      resultSVG += `</svg>`;
      return resultSVG;
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const xPos = 10 + c * 96;
        const yPos = 10 + r * 96;
        const cx = xPos + 43;
        const cy = yPos + 43;
        const cellVal = this.board[r][c];

        if (cellVal === '') {
          resultSVG += `  <a href="https://github.com/imsinghaditya07/imsinghaditya07/issues/new?title=ttt%7C${c}%7C${r}&amp;body=Just+push+%27Submit+new+issue%27+without+editing+the+title."><rect class="cell" x="${xPos}" y="${yPos}" width="86" height="86" rx="5" /></a>\n`;
        } else {
          resultSVG += `  <rect class="cell" x="${xPos}" y="${yPos}" width="86" height="86" rx="5" />\n`;
          if (cellVal === 'X') {
            resultSVG += `  <path d="M${xPos + 20},${yPos + 20} L${xPos + 66},${yPos + 66} M${xPos + 66},${yPos + 20} L${xPos + 20},${yPos + 66}" class="mark-x" />\n`;
          } else {
            resultSVG += `  <circle cx="${cx}" cy="${cy}" r="23" class="mark-o" />\n`;
          }
        }
      }
    }

    resultSVG += `</svg>`;
    return resultSVG;
  }
}

async function run() {
  try {
    const payload = github.context.payload;
    const title = payload.issue ? payload.issue.title : '';

    if (!title.startsWith('ttt|')) {
      console.log('Not a tic-tac-toe move.');
      return;
    }

    // Try to close the issue gracefully
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    if (payload.issue) {
      await octokit.rest.issues.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: payload.issue.number,
        state: 'closed'
      });
    }

    const command = title.replace('ttt|', '').split('|');
    let svgData = fs.readFileSync(FULL_PATH_BOARD, 'utf8');

    if (command[0] === 'reset') {
       // Just generate an empty board again
       const emptyGame = new TicTacToe("");
       fs.writeFileSync(FULL_PATH_BOARD, emptyGame.generateSVG());
       return;
    }

    const c = parseInt(command[0]);
    const r = parseInt(command[1]);

    const game = new TicTacToe(svgData);

    // Player made move
    if (!game.makeMove(r, c, 'X')) {
      console.log("Invalid move or spot taken.");
      return; 
    }

    // Bot make move if game isn't over
    if (!game.isGameOver()) {
       const botMove = game.getBestMoveForO();
       if (botMove) {
         game.makeMove(botMove.r, botMove.c, 'O');
       }
    }

    fs.writeFileSync(FULL_PATH_BOARD, game.generateSVG());
    console.log("Board updated successfully!");

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
