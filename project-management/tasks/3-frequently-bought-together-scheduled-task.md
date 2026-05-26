# Frequently Bought Together: Trigger via scheduled task

## Goal


Replace the current manual/UI trigger for generating "Frequently Bought Together" suggestions with an automatic scheduled task.

## Required Changes

- [ ] Remove the legacy Angular UI completely (no React migration needed).
- [ ] Add a Vendure scheduled job that runs the suggestion logic on a configured interval.
- [ ] Update `README.md` to reflect the removal of the UI and explain how the scheduled task works.
- [ ] Ensure the plugin still compiles and the job executes correctly.


## Notes

- The job should reuse the existing service logic; just change how it is triggered.
- Consider adding a plugin option for the cron interval or a sensible default.
