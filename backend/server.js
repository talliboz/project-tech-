let faults = []
app.get("/api/dashboard", (req, res) => {

const totalFaults = faults.length;

const severityCount = {
low: 0,
medium: 0,
high: 0
};

faults.forEach(f => {
if (severityCount[f.severity] !== undefined) {
severityCount[f.severity]++;
}
});

res.json({
totalFaults,
severityCount,
faults
});
});