# Applications tracker project description

This document describes the screen flow and the features. Technologies and frameworks are in PROJECTSPEC.md.

## Project screen flow

### Entering the app

A visitor registers with an email and a password, or logs in with an email and a password. The password must be at least 8 characters. If the email is already registered, or the password is too short, the register screen shows the error on that field. If login does not match an account, the screen shows one error and does not say whether the email exists.

A successful login or registration opens the dashboard. A signed-in person who opens login or register is sent to the dashboard. A signed-out person who opens any other screen is sent to login.

The session stays in place across a refresh until the sign-in expires or the person logs out. The dashboard has log out. Log out ends the session and opens login.

### Moving between screens

There is no sidebar and no bar that stays on every screen. The dashboard links to the application list, the create-application screen, and log out. The application list links to the create-application screen. Every other signed-in screen links back to the dashboard.

### Dashboard

The dashboard is the first screen after sign-in, including after a refresh while the session is still valid.

It shows a count for each status: Saved, Applied, Screening, Interview, Offer, Rejected, and Withdrawn. A status with no applications still shows a count of zero. The counts are display only.

It lists upcoming interviews. An interview is upcoming when its date and time are still in the future and its outcome is Scheduled. Each row shows the job title, company, date and time, and interview type, and opens that application.

### Application list

The list is a table. The columns are job title, company, status, date applied, and next interview. Next interview is the soonest upcoming interview on that application. The cell is blank when the application has none.

A row opens the application.

Search matches job title and company name. An applied-date range keeps applications whose applied date falls inside the range. Applications with no applied date stay in the list when no range is set, and drop out when a range is set.

The table loads one page at a time and offers next and previous when more results exist.

### Create and edit

Create and edit are separate screens. They use the same fields. Saving a new application opens that application. Saving an edit returns to that application.

### Application detail

One screen shows the application, then its interviews, then its notes.

The application block shows every saved field. It links to the edit screen. Delete asks for confirmation first. After confirmation, the application, its interviews, and its notes are removed, and the list opens. The company stays, so it can be chosen on a later application.

Status changes only on the edit screen.

From the interviews block, the person can add an interview or delete one. They cannot edit an interview. Changing an interview means deleting it and adding another. There is no separate interview screen.

From the notes block, the person can add a note, change its text, or delete it. There is no separate notes screen.

## Features

### Application fields

Required:

- Job title
- Company
- Location
- Status

Location is a city, Remote, or Hybrid, typed as text.

Status is one of Saved, Applied, Screening, Interview, Offer, Rejected, or Withdrawn. The create screen starts on Saved.

Optional:

- Salary, as an amount or a range
- Job posting URL
- Date applied
- A short description written by the person

Company is a choice of companies this person already has, or a new name. A new name creates a company for this person only. Two of this person's companies cannot share a name. The same name can exist for a different person. There is no company list screen and no company detail screen.

### Interview fields

Required:

- Date and time
- Type: Phone, Video, or Onsite
- Outcome: Scheduled, Completed, Passed, Failed, or Cancelled

The add form starts on Scheduled.

Optional:

- Round name
- Interviewer name

Comments about an interview are notes on the application.

### Note fields

A note is text, the time it was added, and the time its text last changed. The created time stays fixed. The updated time changes when the text is edited.
