# D3-Backend

Welcome to D3-Backend

## Prerequisites

Before you get started, make sure you have the following installed:

- [node.js](https://nodejs.org/) - We recommend using Node Version Manager (nvm) to manage your Node.js versions.

## Installation

1. ___Install nvm___
    Instead of using npm to install and uninstall Node versions for your different projects, you can use nvm, which helps you effectively manage your node versions for each project.
    * **For Windows**

    --> Navigate to nvm-windows repository on windows or [click here](https://github.com/coreybutler/nvm-windows/releases).

    --> Install the latest version `nvm-setup.exe`

    --> Open the file that you have downloaded, and complete the installation wizard.

    --> When done, you can confirm that nvm has been installed by running:

        ```bash 
        nvm -v
        ```
    * **For Linux**

    --> In your terminal, run the nvm installer like this 
         ```bash
         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
         # or
         wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
        ```
     --> If throws any error like `curl: (28) Failed to connect to raw.githubusercontent.com port 443: Connection timed out [closed]`

     Run this command 
     ```bash
     sudo nano /etc/hosts
     ```
     ```bash
     185.199.108.133 raw.githubusercontent.com
     ```

     and then try installation again.


    --> You can use curl or bash depending on the command available on your device.

    --> These commands will clone the nvm repository to a <pre>~/.nvm</pre> directory on your device.

    --> Update your profile configuration# sports-backend
