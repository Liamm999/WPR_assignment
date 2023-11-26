/*
=================================================================================================================================

                                    LIRBRARY DECLARATIONS

=================================================================================================================================
*/

"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const { createMySQLConnection } = require("./dbconn");

app.set("view engine", "ejs");

// stattic files inside public folder
app.use(express.static("public"));

app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use(cookieParser());

/*
=================================================================================================================================

                                    SHARED FUNCTIONS

=================================================================================================================================
*/

const getUserIdFromReq = (req) => {
  const userId = req.cookies.userId;
  return userId;
};

const getUsernameFromReq = (req) => {
  const username = req.cookies.username;
  return username;
};

/*
=================================================================================================================================

                                    SINGIN PAGE

=================================================================================================================================
*/

app.get("/", (req, res) => {
  const userId = getUserIdFromReq(req);

  if (userId) {
    return res.redirect("/inbox");
  } else {
    res.render("signin", {
      title: "Sign in page",
    });
  }
});

// Sign in API endpoint
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM wpr2023.user WHERE email = ? AND password = ?`;

  const conn = await createMySQLConnection();

  try {
    const [results] = await conn.execute(sql, [email, password]);

    if (results.length > 0) {
      const user = results[0];
      res.cookie("userId", user.id, {
        httpOnly: true,
      });
      res.cookie("username", user.username, {
        httpOnly: true,
      });
      return res.status(200).json(user);
    } else {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.end();
  }
});

/*
=================================================================================================================================

                                    SignUp PAGE

=================================================================================================================================
*/

app.get("/signup", (req, res) => {
  res.render("signup", {
    title: "Sign up to use our service",
  });
});

// Sign up API endpoint
app.post("/signup", async (req, res) => {
  const { fullname, email, password } = req.body;

  const searchEmailSql = `SELECT * FROM wpr2023.user WHERE email = ?`;
  const signupSql = `
    INSERT INTO wpr2023.user (username, email, password)
    VALUES (?, ?, ?)
    `;

  const conn = await createMySQLConnection();

  try {
    const [results] = await conn.query(searchEmailSql, [email]);

    if (results.length > 0) {
      return res.status(401).json({ error: "Email has existed" });
    }

    await conn.query(signupSql, [fullname, email, password]);
    return res.status(200).json("Sucess");
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.end();
  }
});

/*
=================================================================================================================================

                                    SIGNOUT FEATURE

=================================================================================================================================
*/

app.post("/signout", (req, res) => {
  res.clearCookie("userId");
  res.clearCookie("username");
  return res.status(200).json({ message: "success" });
});

/*
=================================================================================================================================

                                    OUTBOX PAGE

=================================================================================================================================
*/

app.get("/outbox", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const username = getUsernameFromReq(req);

  if (userId === undefined) {
    res.render("err", { errMsg: "Require user id" });
    return;
  }

  var limit = req.query.limit;
  if (limit === undefined) limit = 10;

  var offset = req.query.offset;
  if (offset === undefined) offset = 0;

  const sql =
    "SELECT  \
    wpr2023.email.id, \
    wpr2023.email.sender_id, \
    wpr2023.email.recipient_id, \
    wpr2023.email.subject, \
    wpr2023.email.body, \
    wpr2023.email.attachment_path, \
    wpr2023.email.sent_at, \
    wpr2023.user.username as recipient_fullname \
    FROM wpr2023.email \
    \
    LEFT JOIN wpr2023.user ON  \
    wpr2023.email.recipient_id=wpr2023.user.id \
    \
    WHERE sender_id= " +
    userId +
    " \
    \
    LIMIT " +
    limit +
    " \
    OFFSET " +
    offset +
    ";";

  const conn = await createMySQLConnection();
  const [rows] = await conn.query(sql);

  res.render("outbox", {
    sentEmailList: rows,
    limit,
    offset,
    username,
  });
});

/*
=================================================================================================================================

                                    INBOX PAGE

=================================================================================================================================
*/

app.get("/inbox", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const username = getUsernameFromReq(req);

  if (userId === undefined) {
    res.render("err", { errMsg: "Require user id" });
    return;
  }

  var limit = req.query.limit;
  if (limit === undefined) limit = 10;

  var offset = req.query.offset;
  if (offset === undefined) offset = 0;

  const sql =
    "SELECT  \
    wpr2023.email.id, \
    wpr2023.email.sender_id, \
    wpr2023.email.recipient_id, \
    wpr2023.email.subject, \
    wpr2023.email.body, \
    wpr2023.email.attachment_path, \
    wpr2023.email.sent_at, \
    wpr2023.user.username as sender_fullname \
    FROM wpr2023.email \
    \
    LEFT JOIN wpr2023.user ON  \
    wpr2023.email.sender_id=wpr2023.user.id \
    \
    WHERE recipient_id= " +
    userId +
    " \
    \
    LIMIT " +
    limit +
    " \
    OFFSET " +
    offset +
    ";";

  const conn = await createMySQLConnection();
  const [rows] = await conn.query(sql);

  res.render("inbox", {
    sentEmailList: rows,
    limit,
    offset,
    username,
  });
});

/*
=================================================================================================================================

                                    COMPOSE PAGE

=================================================================================================================================
*/

app.get("/compose", (req, res) => {
  const username = getUsernameFromReq(req);
  res.render("compose", {
    title: "This is a motherfucker compose page",
    username,
  });
});

/*
=================================================================================================================================

                                    EMAIL DETAIL PAGE

=================================================================================================================================
*/

app.get("/email-detail", async (req, res) => {
  const userId = getUserIdFromReq(req);
  const username = getUsernameFromReq(req);

  if (userId === undefined) res.render("err", { errMsg: "Require user id" });

  var emailId = req.query.emailId;

  if (emailId === undefined) {
    res.render("err", { errMsg: "Require email id" });
    return;
  }

  const sql =
    "SELECT * FROM wpr2023.email \
    WHERE id=" +
    emailId +
    " \
    AND (sender_id=" +
    userId +
    " OR recipient_id=" +
    userId +
    ");";

  const conn = await createMySQLConnection();
  const [rows] = await conn.query(sql);
  if (rows.length === 0) {
    res.render("err", { errMsg: "Email not exist" });
    return;
  }

  res.render("emaildetail", { email: rows[0], username });
});

/*
=================================================================================================================================

                                    START SERVER

=================================================================================================================================
*/

app.use(express.static("public"));
app.listen(8000);
