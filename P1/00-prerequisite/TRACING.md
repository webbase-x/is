# Tracing assessment v1

One symbol/pattern per board. SVG guide and grading canvas use the same font, baseline and 720×340 coordinate system after fonts are ready. Decorative guide lines and start dots are not graded.

Score = harmonic mean of template coverage and ink precision. Both use a 12-unit tolerance (6 pixels on the 360×170 assessment mask). Empty ink is not submitted; a blank mask scores zero. Extra scribbles reduce precision; missing parts reduce coverage. This is similarity to the on-screen template, not handwriting beauty or a percentage probability of correctness. No stroke-order/direction score is claimed.

Each character contributes equally to the activity mean. The warm-up line pattern is tracked separately and is not included in the character mean. An incomplete set shows progress instead of a misleading average. First/best/latest and attempt count are kept per symbol; first and best means are shown only after all symbols have been assessed.

Guests use tab-session storage. Authenticated learners and the teacher-selected pupil/class context use `p1_tracing` and `p1_trace_attempts`. Changing the active learner clears the board and loads that context's records. Failed saves are explicitly reported. Class results do not create marks for every pupil. Teachers can open คะแนนฝึกเขียน in the classroom menu.

Database extension is additive (`P1/db/tracing.sql`); old classroom/reader tables and RPCs are unchanged. The public RPC is security-invoker; private authorization resolves pupil identity server-side and checks teacher room ownership or active, unexpired classroom membership. No new anonymous table access. The generic anonymous-sign-in advisor warning is constrained by the approved-teacher predicate; anonymous student sessions cannot select the table directly. `tests/tracing-db.sql` verifies isolation and authorization with rolled-back fixtures.
