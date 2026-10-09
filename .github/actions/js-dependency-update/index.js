const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const setupGit = async () => {
    await exec.exec(`git config --global user.name "gh-automations"`);
    await exec.exec(`git config --global user.email "gh-automations@email.com"`);
};
const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ dirName }) => /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

const setupLogger = ({ debug, prefix } = { debug: false, prefix: '' }) => ({
    debug: (message) => {
        if (debug) {
            core.info(`DEBUG ${prefix}${prefix? ' : ' : ''}${message}`);
        }
    },
    info: (message) => {
        core.info(`${prefix}${prefix? ' : ' : ''}${message}`);
    },
    error: (message) => {
        core.error(`${prefix}${prefix? ' : ' : ''}${message}`);
    }
});

async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const headBranch = core.getInput('head-branch');
    const ghToken = core.getInput('gh-token', { required: true });
    const workingDir = core.getInput('working-directory', { required: true });
    const debug = core.getBooleanInput('debug');
    const logger = setupLogger({ debug, prefix: '[js-dependency-update]' });

    const commonExecOpts = {
        cwd: workingDir
    };

    core.setSecret(ghToken);

    logger.debug('Validating inputs - base-branch, head-branch, working-directory');

    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed(`Invalid base-branch name: ${baseBranch}. Branch names should only contain alphanumeric characters, dashes, underscores, dots, and slashes.`);
        return;
    }

    if (!validateBranchName({ branchName: headBranch })) {
        core.setFailed(`Invalid head-branch name: ${headBranch}. Branch names should only contain alphanumeric characters, dashes, underscores, dots, and slashes.`);
        return;
    }

    if (!validateDirectoryName({ dirName: workingDir })) {
        core.setFailed(`Invalid working-directory name: ${workingDir}. Directory names should only contain alphanumeric characters, dashes, underscores, and slashes.`);
        return;
    }

    logger.debug(`base branch is ${baseBranch}`);
    logger.debug(`target branch is ${headBranch}`);
    logger.debug(`working directory is ${workingDir}`);

    logger.debug('Checking for package updates')

    await exec.exec('npm update', [], { ...commonExecOpts });

    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], { ...commonExecOpts });

    if (gitStatus.stdout.length > 0) {
        logger.info(`There are updates available`);
        logger.info(`Setting up git`);
        await setupGit();
        
        logger.info(`Committing and pushing changes to ${headBranch}`);
        await exec.exec(`git checkout -b ${headBranch}`, [], { ...commonExecOpts });
        await exec.exec(`git add package.json package-lock.json`, [], { ...commonExecOpts });
        await exec.exec(`git commit -m "chore: update dependencies"`, [], { ...commonExecOpts });
        await exec.exec(`git push -u origin ${headBranch} --force`, [], { ...commonExecOpts });

        logger.info(`Fetching octokit API`);
        const octokit = github.getOctokit(ghToken);
        try {
            logger.info(`Creating PR from ${headBranch} to ${baseBranch}`);
            await octokit.rest.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                title: `Update npm dependencies`,
                body: `This pull request updates npm packages`,
                base : baseBranch,
                head : headBranch
            });
        } catch (e) {
            logger.error(`Failed to create PR: ${e.message}`);
            core.setFailed();
            logger.error(e);
        }
    } else {
        logger.info(`No updates available`);
    }

    /*
        1. Parse inputs
            1.1 base-branch from which to check for updates
            1.2 head-branch to use to create the PR
            1.3 GitHub token for auth purposes
            1.4 Working directory for which to check for dependencies
        2. Execute the npm update command within the working directory
        3. Check whether there are modified package*.json files
        4. If there are modified files:
            4.1 Add and commit files to the target branch
            4.2 Create a PR to the base-branch using the head-branch
        5 Otherwise, conclude the custom action

    */
}

run();
