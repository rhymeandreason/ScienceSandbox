When you add templates later, the natural shape is one section per shell in the reference and the check becoming "loads at least one of these", so nothing in the prompt has to change.

Templates should be shells the model mounts, not skeletons it copies, and each one earns its place by being a thing the model keeps hand-building today. From the eval runs and the briefs, four are worth it, in this order.

1\. \*\*Compare.\*\* Two scenes side by side with one shared control and one readout per side. This is what "plant cell vs animal cell", "HbA vs HbS", "ocean vs river" and "ice vs liquid water" all are, and today the model fakes it with steps. The shell owns the split, the synced camera and the labels; the page mounts two components and says what differs. The Cell brief's presets are made for it.

2\. \*\*Experiment.\*\* Independent variable, a run button, a results chart, and a claim the student writes before running. This is the potato-cylinder osmosis lab from the Cell brief, the salt-in-water freezing point, the leaf under different light. The chart the reference describes in three lines becomes a real part of the shell, with a series the page appends to per run. This is the template teachers will ask for most.

3\. \*\*Explore.\*\* One scene, no steps, a set of hotspots and a question bank. "What is that?" gets a note, and the panel lists what the student has found. The Leaf and Proteinbox apps want this shape and the step shell is wrong for them: nothing moves, so there is nothing to step through.

4\. \*\*Sweep.\*\* One parameter on a slider, the scene and one number live, and a chart that draws the curve as the student drags. Tonicity against cell volume, salinity against water flow, temperature against hydrogen-bond count. Halfway between Experiment and Explore, and the cheapest to build, since the step shell's \`range\` helper already does most of it.

Two that look tempting and are not worth it yet. A \*\*quiz\*\* template puts assessment before the model can be trusted with a right answer. A \*\*scale ladder\*\* that flies from cell to membrane to molecule is real, but it is a component contract question, the handoff the Cell brief specifies, not a panel layout.

For each one: build it by hand on one real page first, keep the reference section to the mount call and the class names, and add its script to the \`validate\` list so a page must load one shell. The measure is the same as before, the model's own \`<style>\` block shrinking toward empty.
