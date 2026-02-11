var canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 128;
var ctx = canvas.getContext('2d');
ctx.fillStyle = '#2874f0';
ctx.fillRect(0, 0, 128, 128);
ctx.fillStyle = '#ff9f00';
ctx.font = '80px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('F', 64, 64);
// This is just a script to generate icon.
// Can't run canvas in node without proper setup.
// I'll just create a simple base64 or download a placeholder.
