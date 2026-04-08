# 🤝 Contributing to Webhook Queue

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to **Webhook Queue**. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 🌈 How Can I Contribute?

### Reporting Bugs 🐛
This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Check if the bug has already been reported.**
- **Provide a clear, descriptive title.**
- **Describe the exact steps to reproduce the problem.**
- **Include screenshots/logs if applicable.**

### Suggesting Enhancements 💡
This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

- **Check if there's already a similar suggestion.**
- **Explain why this enhancement would be useful.**
- **Describe the behavior you'd like to see.**

### Pull Requests 🚀
The process which has to be followed to get your changes merged:

1.  **Fork the repo** and create your branch from `main`.
2.  **Ensure dependencies are installed** (`npm install`).
3.  **Implement your changes.**
4.  **Add comments** to your code (Industry Standard).
5.  **Check linting/style** (2-space indentation).
6.  **Issue that PR!**

## 🏗️ Code Style Guidelines

- **Variables**: Use `camelCase`.
- **Indentation**: 2 spaces.
- **Comments**: Use JSDoc for functions and clear inline comments for complex logic.
- **Logging**: Always prefix logs with the module name in brackets (e.g., `[Webhook]`).
- **Safety**: Ensure errors are handled but eventually propagated in workers to trigger retries.

## 🗺️ Community & Support

- **Need help?** Open an issue with the `question` label.
- **Want to talk?** Start a discussion in the Discussions tab.

---

Keep coding and stay awesome! 🚀
