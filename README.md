# Three-Cup Shell Game

A tiny browser game built with HTML, CSS, and JavaScript. Watch the cups shuffle, then guess where the red ball is.

## Features
- 3 cups and a red ball
- Brief peek before the shuffle
- Increasing shuffle speed based on difficulty
- Keyboard-accessible cups (Enter/Space)
- Win/Loss tracking

## How to run
Just open `index.html` in your browser.

Optionally, serve it locally (avoids some browser security restrictions when loading files):

```bash
# from the project folder
python3 -m http.server 5173
# then visit http://localhost:5173/
```

## Gameplay
1. Click Start and briefly see the ball.
2. Cups cover the ball and begin shuffling, getting faster.
3. Click the cup you think hides the ball.
4. If correct, you win! Press Play Again to keep going.

## Notes
- Difficulty slider tunes number of swaps and minimum speed.
- Pure front-end, no build step.
