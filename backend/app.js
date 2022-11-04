const express = require('express');
const app = express();
require('dotenv').config();

// Disable CORS policy to allow to run with frontend
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//DB info
const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD
});

/*
connection.connect((error) => {
    if (error) {
        console.log(error);
    }
});
connection.query(`use Library`);
*/

app.use(express.json());

//API Routes

//Get/filter books by book ISBN, book title, book author
app.get('/books', async (req, res) => {
    try {
        const { isbn, title, author } = req.query;
        let q = 'select CD.Isbn, Title, Author_id, `Name`, Loan_id from (select Isbn, Title, BC.Author_id, `Name` from (select BOOK.Isbn, Title, AB.Author_id from BOOK_AUTHORS as AB join BOOK on AB.Isbn = BOOK.Isbn) as BC join AUTHORS on BC.Author_id = AUTHORS.Author_id) as CD left join BOOK_LOANS on CD.Isbn = BOOK_LOANS.Isbn';
        let w = 'WHERE';

        //console.log(isbn, title, author);

        if (isbn) {
            if (w === 'WHERE') {
                w += ` Isbn = ${isbn}`
            }
            else {
                w += ` AND Isbn = ${isbn}`
            }
        }

        if (title) {
            if (w === 'WHERE') {
                w += ` UPPER(Title) LIKE UPPER("%${title}%")`;
            }
            else {
                w += ` AND UPPER(Title) LIKE UPPER("%${title}%")`;
            }
        }

        if (author) {
            if (w === 'WHERE') {
                w += ` UPPER(Name) LIKE UPPER("%${author}%")`;
            }
            else {
                w += ` AND UPPER(Name) LIKE UPPER("%${author}%")`;
            }
        }

        if (w !== 'WHERE') {
            q += ' ';
            q += w;
        }

        let books = await new Promise((resolve, reject) => {
            connection.query(q, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        return res.status(200).json({ books });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

//Add new borrower to the database
app.post('/borrowers', async (req, res) => {
    try {
        const { ssn, name, address, phone } = req.body;

        function generateCardID() {
            id = '';
            for (let i = 0; i < 20; i++) {
                digit = Math.floor(Math.random() * 10);
                id += digit.toString();
            }

            return id;
        }

        if (/^[a-zA-Z() ]+$/.test(name) === false) {
            return res.status(400).json({ error: 'Name can only contain alphabetical letters' });
        }

        if (name.length > 100) {
            name = name.subtring(0, 100);
        }

        if (ssn.length === 11) {
            if (/[0-9]{3}-[0-9]{2}-[0-9]{4}/.test(ssn) === false) {
                return res.status(400).json({ error: 'Invalid SSN' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid SSN' });
        }

        if (address.length > 200) {
            address = address.substring(0, 100);
        }

        if (phone.length === 10) {
            if (/[0-9]{10}/.test(phone) === false) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        let isValidSSN = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BORROWER WHERE Ssn = '${ssn}'`, (error, results, fields) => {
                if (error) {
                    reject(error)
                }
                else {
                    resolve(results);
                }
            });
        });

        if (isValidSSN.length > 0) {
            return res.status(400).json({ error: 'Given SSN already exists' });
        }

        let borrowers = await new Promise((resolve, reject) => {
            connection.query('select Card_id from BORROWER', (error, results) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        let allCardIDs = [];
        for (let i = 0; i < borrowers.length; i++) {
            allCardIDs.push(borrowers[i].Card_id);
        }
        let uniqueIDs = new Set(allCardIDs);

        let cardID;
        let isValid = false;
        while (isValid === false) {
            cardID = generateCardID();
            if (uniqueIDs.has(cardID) === false) {
                isValid = true;
            }
        }

        let finalResult = await new Promise((resolve, response) => {
            connection.query(`INSERT INTO BORROWER VALUES ('${cardID}', '${ssn}', '${name}', '${address}', '${phone}')`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        return res.status(201).json({ message: 'Successfully added borrower!' });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

//Check a book out
app.post('/checkout', async (req, res) => {
    try {
        const { isbn, borrowerID } = req.body;

        if (!isbn) {
            return res.status(400).json({ error: 'Please provide an ISBN for the book to check out' });
        }

        if (!borrowerID) {
            return res.status(400).json({ error: 'Please provide the card ID of the borrower' });
        }

        let requestedBook = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BOOK WHERE Isbn = "${isbn}"`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (requestedBook.length === 0) {
            return res.status(400).json({ error: 'Invalid ISBN or given ISBN does not exist' });
        }

        let requestedBorrower = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BORROWER WHERE Card_id = "${borrowerID}"`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (requestedBorrower.length === 0) {
            return res.status(400).json({ error: 'Invalid borrower card ID or card ID does not exist' });
        }

        let isBookCheckedOut = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BOOK_LOANS WHERE Isbn = "${isbn}" AND Date_in IS NULL`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (isBookCheckedOut.length > 0) {
            return res.status(400).json({ error: 'Requested book is currently checked out.' });
        }

        let hasReachedLimit = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BOOK_LOANS WHERE Card_id = "${borrowerID}" and Date_in IS NULL`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (hasReachedLimit.length === 3) {
            return res.status(400).json({ error: 'Cannot check out requested book since borrower has reached the check-out limit' });
        }

        function generateLoanID() {
            let id = '';
            for (let i = 0; i < 10; i++) {
                let digit = Math.floor(Math.random() * 10);
                id += digit.toString();
            }
            return id;
        }

        let allLoanIDs = await new Promise((resolve, reject) => {
            connection.query(`SELECT Loan_id FROM BOOK_LOANS`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        let loanIDs = [];
        for (let i = 0; i < allLoanIDs.length; i++) {
            loanIDs.push(allLoanIDs[i].Loan_id);
        }
        let uniqueLoanIDs = new Set(loanIDs);

        let loanID;
        let isValid = false;
        while (isValid === false) {
            loanID = generateLoanID();
            if (uniqueLoanIDs.has(loanID) === false) {
                isValid = true;
            }
        }

        function getSQLDate(date) {
            return new Date(
                date.toLocaleString('en-US', {
                    timeZone: 'America/Chicago',
                }),
            ).toDateString();

            //return cstDate.toISOString().split('T')[0];
        }

        let today = new Date();
        let twoWeeksFromNow = new Date(Date.now() + 12096e5);

        today = getSQLDate(today);
        twoWeeksFromNow = getSQLDate(twoWeeksFromNow);

        let monthsObject = {
            'Jan': '01',
            'Feb': '02',
            'Mar': '03',
            'Apr': '04',
            'May': '05',
            'Jun': '06',
            'Jul': '07',
            'Aug': '08',
            'Sep': '09',
            'Oct': '10',
            'Nov': '11',
            'Dec': '12'
        };

        let todayComponents = today.split(' ');
        today = todayComponents[3] + '-' + monthsObject[todayComponents[1]] + '-' + todayComponents[2];

        let twoWeeksFromNowComponents = twoWeeksFromNow.split(' ');
        twoWeeksFromNow = twoWeeksFromNowComponents[3] + '-' + monthsObject[twoWeeksFromNowComponents[1]] + '-' + twoWeeksFromNowComponents[2];

        //console.log(today);
        //console.log(twoWeeksFromNow);

        let q1 = `INSERT INTO BOOK_LOANS (Loan_id, Isbn, Card_id, Date_out, Due_date)`;
        let q2 = `VALUES ("${loanID}", "${isbn}", "${borrowerID}", "${today}", "${twoWeeksFromNow}")`;
        let q = q1 + ' ' + q2;
        let finalResult = await new Promise((resolve, reject) => {
            connection.query(q, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        return res.status(201).json({ message: 'Successfully checked out book!' });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

//Check a book in
app.patch('/checkin', async (req, res) => {
    try {
        const { loanID } = req.body;

        let loanExists = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BOOK_LOANS WHERE Loan_id = "${loanID}"`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (loanExists.length === 0) {
            return res.status(400).json({ error: 'Invalid Loan ID or Loan ID does not exist' });
        }

        let isValidLoan = await new Promise((resolve, reject) => {
            connection.query(`SELECT * FROM BOOK_LOANS WHERE Loan_id = "${loanID}" AND Date_in IS NULL`, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        if (isValidLoan.length === 0) {
            return res.status(400).json({ error: 'Book is already checked in' });
        }

        function getSQLDate(date) {
            return new Date(
                date.toLocaleString('en-US', {
                    timeZone: 'America/Chicago',
                }),
            ).toDateString();

            //return cstDate.toISOString().split('T')[0];
        }

        let today = new Date();
        today = getSQLDate(today);

        let monthsObject = {
            'Jan': '01',
            'Feb': '02',
            'Mar': '03',
            'Apr': '04',
            'May': '05',
            'Jun': '06',
            'Jul': '07',
            'Aug': '08',
            'Sep': '09',
            'Oct': '10',
            'Nov': '11',
            'Dec': '12'
        };

        let todayComponents = today.split(' ');
        today = todayComponents[3] + '-' + monthsObject[todayComponents[1]] + '-' + todayComponents[2];

        let q1 = 'UPDATE BOOK_LOANS';
        let q2 = `SET Date_in = "${today}"`;
        let q3 = `WHERE Loan_id = ${loanID}`;
        q = q1 + ' ' + q2 + ' ' + q3;
        let finalResult = await new Promise((resolve, reject) => {
            connection.query(q, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }     
            });
        });

        return res.status(200).json({ message: 'Successful Check In!' });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

//Get Book Loans
app.get('/bookloans', async (req, res) => {
    try {
        const { isbn, cardID, bname } = req.query;
        let q1 = 'select BORROWER.Card_id, Bname, Loan_id, Isbn, Date_out, Due_date from (select * from BOOK_LOANS where Date_in is null) as A join BORROWER on BORROWER.Card_id = A.Card_id';
        let q2 = 'WHERE';

        if (isbn) {
            q2 += ` Isbn = "${isbn}"`;
        }

        if (cardID) {
            if (q2 === 'WHERE') {
                q2 += ` A.Card_id = "${cardID}"`;
            }
            else {
                q2 += ` AND A.Card_id = "${cardID}"`;
            }
        }

        if (bname) {
            if (q2 === 'WHERE') {
                q2 += ` UPPER(Bname) LIKE UPPER("%${bname}%")`;
            }
            else {
                q2 += ` AND UPPER(Bname) LIKE UPPER("%${bname}%")`;
            }
        }

        let q;
        if (q2 === 'WHERE') {
            q = q1;
        }
        else {
            q = q1 + ' ' + q2;
        }

        let loans = await new Promise((resolve, reject) => {
            connection.query(q, (error, results, fields) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });

        return res.status(200).json({ loans });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error });
    }
});

const port = process.env.PORT || 4000;
const start = async () => {
    try {
        await new Promise((resolve, reject) => {
            connection.connect((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });

        await new Promise((resolve, reject) => {
            connection.query(`use Library`, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });

        app.listen(port, () => {
            console.log(`Server is listening on port ${port}`);
        });
    }
    catch (error) {
        console.log(error)
    }
};

start();