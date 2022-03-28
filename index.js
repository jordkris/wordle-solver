import puppeteer from 'puppeteer-extra';
import { $ } from 'puppeteer-shadow-selector';
import fs from 'fs';
import readline from 'readline';
import chalk from 'chalk';
import process from 'process';
import axios from 'axios';

class WordleSolver {
    constructor(wordBank) {
        this.wordBank = wordBank;
        this.executablePath = './node_modules/puppeteer/.local-chromium/win64-970485/chrome-win/chrome.exe';
        this.defaultTimeOut = 20000;
        this.headless = false;
        this.args = [
            '--start-maximized', // you can also use '--start-fullscreen'
            // `-profile-directory=${this.profile}`
        ];
        this.dumpWords = wordBank;
        this.absentLetters = [];
        this.avoidLetters = [
            [],
            [],
            [],
            [],
            []
        ];
        this.presentLetters = [];
        this.correctLetters = Array(5).fill('');
        this.historyWords = [];
        this.guessWords = [];
    }

    initBrowser = async() => {
        this.timer = this.consoleTimer('Open browser \t');
        this.browser = await puppeteer.launch({
            executablePath: this.executablePath,
            headless: this.headless,
            defaultViewport: null,
            // userDataDir: this.userDataDir,
            args: this.args
        });
    }

    consoleTimer = (message, shuffleMode = false) => {
        this.clearTimer(this.timer);
        let diff = 1;
        let initTime = new Date().getTime();
        let realTime;
        let id = setInterval(() => {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                realTime = (new Date().getTime() - initTime) / 1000;
                if (shuffleMode) {
                    message = `big brain time.${'.'.repeat(Math.floor(realTime / diff))}`;
                }
                process.stdout.write(message + ' |\t' + chalk.yellow(`Elapsed time: ${realTime}s`));
            },
            diff);
        return id;
    }

    clearTimer = (timer) => {
        clearInterval(timer);
        process.stdout.write('\n');
    }

    // getInnerHTML = async(elm) => {
    //     const elmProperty = await elm.getProperty('innerHTML');
    //     return await elmProperty.jsonValue();
    // }

    click = async(elm) => {
        await elm.click();
    }

    closePopUp = async() => {
        await this.page.waitForTimeout(500);
        const popUp = await $(this.page, `game-app::shadow-dom(game-theme-manager > header)`);
        await this.click(popUp);
    }

    submit = async(text) => {
        for (let i = 0; i < 5; i++) {
            await this.page.keyboard.press('Backspace');
        }
        let counter = 0;
        while (counter < text.length) {
            await this.page.waitForTimeout(200);
            await this.page.keyboard.type(text[counter]);
            counter++;
        }
        await this.page.keyboard.press('Enter');
    }

    getEvaluation = async(word) => {
        try {
            const gameRow = await $(this.page, `game-app::shadow-dom(game-theme-manager game-row[letters="${word.toLowerCase()}"]::shadow-dom(div))`);
            const gameTiles = await gameRow.$$(':scope > *');
            const evaluation = [];
            for (let gameTile of gameTiles) {
                const attr = await this.page.evaluate(el => el.getAttribute('evaluation'), gameTile);
                evaluation.push(attr);
            }
            return evaluation;
        } catch (e) {
            throw e;
        }
    }

    checkEvaluation = (evaluation) => {
        return evaluation.filter(value => value !== null).length === 5 ? true : false;
    }

    isSingleLetter = (letter, word) => {
        let counter = 0;
        for (let i = 0; i < word.length; i++) {
            if (letter === word[i]) {
                counter++;
            }
        }
        if (counter === 1) {
            return true;
        } else {
            return false;
        }
    }

    checkWord = (word) => {
        let res = false;
        let flagHistory = false;
        let flagAbsent = false;
        let flagPresent = false;
        let flagAvoid = false;
        let flagCorrect = false;
        if (this.historyWords.includes(word)) {
            flagHistory = true;
        }
        for (let i = 0; i < this.absentLetters.length; i++) {
            if (word.includes(this.absentLetters[i])) {
                flagAbsent = true;
                break;
            }
        }
        if (this.presentLetters.length) {
            for (let i = 0; i < this.presentLetters.length; i++) {
                if (word.includes(this.presentLetters[i])) {
                    if (i === this.presentLetters.length - 1) {
                        flagPresent = true;
                    }
                } else {
                    break;
                }
            }
        } else {
            flagPresent = true;
        }
        for (let i = 0; i < this.avoidLetters.length; i++) {
            if (this.avoidLetters[i].length) {
                for (let j = 0; j < this.avoidLetters[i].length; j++) {
                    if (this.avoidLetters[i][j] === word[i]) {
                        flagAvoid = true;
                        break;
                    }
                }
            }
        }
        for (let i = 0; i < this.correctLetters.length; i++) {
            if (this.correctLetters[i] !== '') {
                if (this.correctLetters[i] !== word[i]) {
                    break;
                }
            }
            if (i === this.correctLetters.length - 1) {
                flagCorrect = true;
            }
        }
        if (!flagHistory && !flagAbsent && flagPresent && !flagAvoid && flagCorrect) {
            res = true;
        }
        // console.log(word, res, `history: ${flagHistory}, absent: ${flagAbsent}, present: ${flagPresent}, avoid: ${flagAvoid}, correct: ${flagCorrect}`);
        return res;
    }

    randomPick = (arr) => {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    shuffle = (arr) => {
        return arr
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
    }

    isDictWord = async(word) => {
        return await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`).catch((error) => {
            // console.error(chalk.red(error));
        });
    }

    winChecker = () => {
        if (this.correctLetters.filter(letter => letter !== '').length === 5) {
            return 'win';
        } else {
            if (this.guessWords.length >= 6) {
                return 'lose';
            } else {
                return 'continue';
            }
        }
    }

    toDo = async() => {
        try {
            let counter = 1,
                dictResult, evaluationTemp,
                flagFinish, flagStatus, tempWord;
            this.page = (await this.browser.pages())[0];
            this.page.setDefaultTimeout(this.defaultTimeOut);
            this.timer = this.consoleTimer('Open link \t');
            await this.page.goto('https://www.nytimes.com/games/wordle/index.html');
            this.page.waitForTimeout(500);
            await this.closePopUp();
            while (true) {
                console.log('\n');
                console.log(chalk.blue('============== Try ' + counter + ' ==============='));
                console.log('correct:', this.correctLetters);
                console.log('present:', this.presentLetters);
                console.log('avoid:', this.avoidLetters);
                console.log('absent:', this.absentLetters);
                this.timer = this.consoleTimer('', true);
                while (true) {
                    try {
                        this.dumpWords = this.shuffle(counter === 1 ? this.wordBank.filter(word => this.checkWord(word)) : this.dumpWords.filter(word => this.checkWord(word)));
                        tempWord = counter === 1 ? (this.isRandomWord ? this.randomPick(this.dumpWords) : this.openerWord) : this.randomPick(this.dumpWords);
                        dictResult = await this.isDictWord(tempWord);
                        if (dictResult.data.length) {
                            this.clearTimer(this.timer);
                            if (this.isRandomWord || counter > 1) {
                                console.log('suggest words:', this.dumpWords.length, 'items');
                                console.log(this.dumpWords);
                            }
                            break;
                        }
                    } catch (error) {
                        this.historyWords.push(tempWord);
                    }
                }
                this.timer = this.consoleTimer(`lucky word: ${tempWord}`);
                await this.page.waitForTimeout(3000);
                await this.submit(tempWord);
                this.historyWords.push(tempWord);
                await this.page.waitForTimeout(1000);
                evaluationTemp = await this.getEvaluation(tempWord);
                this.timer = this.consoleTimer(evaluationTemp);
                if (this.checkEvaluation(evaluationTemp)) {
                    this.guessWords.push(tempWord);
                    evaluationTemp.forEach((letter, index) => {
                        switch (letter) {
                            case 'correct':
                                this.correctLetters[index] = tempWord[index];
                                break;
                            case 'present':
                                if (!this.presentLetters.includes(tempWord[index])) {
                                    this.presentLetters.push(tempWord[index]);
                                    this.presentLetters.sort();
                                }
                                this.avoidLetters[index].push(tempWord[index]);
                                this.avoidLetters[index].sort();
                                break;
                            case 'absent':
                                if (this.isSingleLetter(tempWord[index], tempWord)) {
                                    this.absentLetters.push(tempWord[index]);
                                    this.absentLetters.sort();
                                }
                                break;
                        }
                    });
                } else {
                    console.log(chalk.red(`This word is not in wordle's dictionary!`));
                }
                switch (this.winChecker()) {
                    case 'win':
                        this.clearTimer(this.timer);
                        console.log(chalk.green('============= You Win =============='));
                        flagFinish = true;
                        flagStatus = 'win';
                        break;
                    case 'lose':
                        this.clearTimer(this.timer);
                        console.log(chalk.red('==== You Lose, Repeat Execution ===='));
                        flagFinish = true;
                        flagStatus = 'lose';
                        break;
                    default:
                        flagFinish = false;
                        // if (counter % 1 === 0) console.clear();
                        counter++;
                        break;
                }
                if (flagFinish) {
                    await this.page.waitForTimeout(5000);
                    await this.browser.close();
                    break;
                }
            }
            return flagStatus;
        } catch (e) {
            this.clearTimer(this.timer);
            await this.page.waitForTimeout(5000);
            await this.browser.close();
            throw e;
        }
    }

    readLine = async(question) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    start = async() => {
        // console.clear();
        console.log('========== Wordle Solver ===========');
        try {
            let flagInput;
            while (true) {
                let isRandomWord = await this.readLine('Random word? (y/n) ');
                switch (isRandomWord.toLowerCase()) {
                    case 'y':
                        this.isRandomWord = true;
                        flagInput = true;
                        break;
                    case 'n':
                        this.isRandomWord = false;
                        let dictResult;
                        while (true) {
                            this.openerWord = (await this.readLine('Enter word: ')).toUpperCase();
                            if (this.openerWord.length === 5) {
                                try {
                                    dictResult = await this.isDictWord(this.openerWord);
                                    if (dictResult.data.length) {
                                        break;
                                    }
                                } catch {
                                    console.log(chalk.red(`This word is not in the wiki's dictionary!`));
                                }
                            } else {
                                console.log(chalk.red('Word length must be 5!'));
                            }
                        }
                        flagInput = true;
                        break;
                    default:
                        flagInput = false;
                        console.log(chalk.red('Invalid input!'));
                }
                if (flagInput) break;
            }
            await this.initBrowser();
            return await this.toDo();
        } catch (e) {
            console.log(chalk.red(e));
        }
    }
}
(async() => {
    fs.readFile('./wordbank.txt', (error, data) => {
        try {
            if (error) throw error;
            let allWords = data.toString().split('\n').map(v => v.trim().toLowerCase());
            let allFiveLetter = allWords.filter(word => word.length === 5 && /^[a-zA-Z()]+$/.test(word)).map(word => word.toUpperCase());
            let solver, stop = false;
            (async() => {
                while (true) {
                    await Promise.all([new Promise(async(resolve, reject) => {
                        solver = new WordleSolver(allFiveLetter);
                        try {
                            resolve(solver.start());
                        } catch (e) {
                            reject(e);
                        }
                    })]).then((result) => {
                        stop = (result[0] === 'win');
                    });
                    if (stop) break;
                }
            })()
        } catch (e) {
            console.error(chalk.red(e));
        }
    });
})()