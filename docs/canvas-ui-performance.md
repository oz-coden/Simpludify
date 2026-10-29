# Canvas UI measurements

Measurement scripts and recorded results will be linked here after the current implementation is validated. No runtime layout dependency has been added. The selected implementation is a bounded Flex subset, not full CSS conformance. Dirty changes traverse the root and hit testing is O(visible nodes); static frames skip layout and visual synchronization.

The baseline for bundle comparison is `89491c638e070c575fcee89cb08635fbaac67f01`. Yoga 3.2.1 is inspected in an isolated temporary directory, not installed into the engine. The published package reports MIT, 224272 unpacked bytes and includes a base64 WebAssembly loader; actual production/gzip comparisons, behavioral comparison and CPU/memory observations are pending. Historical trial sizes in earlier conversations are not current measurements.
