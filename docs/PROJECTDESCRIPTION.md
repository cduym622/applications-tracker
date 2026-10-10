# Applications tracker project description

This document describes the screen flow and the features. Technologies and frameworks are in PROJECTSPEC.md.

## Project screen flow

### Entering the app

The first screen for a signed-out visitor is a public landing page. The same page opens after log out.

The landing page has a top bar. Applications Tracker is on the left. Login and Register are on the right. The rest of the page uses the same type and colors as the other screens. It has a short headline and one sentence about tracking applications.

A visitor registers with an email and a password, or logs in with an email and a password. The password must be at least 8 characters and must not be a common password. If the email is already registered, or the password is too short or too common, the register screen shows the error on that field. If login does not match an account, the screen shows one error and does not say whether the email exists.

A successful login or registration opens the dashboard. A signed-in person who opens the landing page, login, or register is sent to the dashboard. A signed-out person who opens a signed-in screen is sent to login.

The session stays in place across a refresh until the sign-in expires or the person logs out. The dashboard has log out. Log out ends the session and opens the landing page.

### Moving between screens

There is no sidebar, and no bar that stays on every signed-in screen. The landing page is the only screen with a top bar.

The dashboard links to the application list, the create-application screen, and log out. The application list links to the create-application screen. Create and edit link back to the dashboard.

The application list keeps search, the applied-date range, the status limit, and the page in its address. Application detail keeps the address it was opened from, and its back control uses that address. The back label names that previous screen.

- From All applications, Back returns to that list with the same search, dates, and page. The label is All applications.
- From a status card, Back returns to that filtered list with the same search, dates, and page. The label is the status name, such as Applied.
- From an upcoming interview on the dashboard, Back returns to the dashboard. The label is Dashboard.
- A detail address opened on its own goes back to the full application list. The label is All applications.

### Dashboard

The dashboard is the first screen after sign-in, including after a refresh while the session is still valid.

It shows a count for each status: Saved, Applied, Screening, Interview, Offer, Rejected, and Withdrawn. A status with no applications still shows a count of zero. Each status card opens the application list limited to that status, including a card whose count is zero. All applications opens the list with no status limit.

It lists the soonest 10 upcoming interviews. An interview is upcoming when its date and time are still in the future and its outcome is Scheduled. Each row shows the job title, company, date and time, and interview type, and opens that application.

### Application list

The list is a table. The columns are job title, company, status, date applied, and next interview. Next interview is the soonest upcoming interview on that application. The cell is blank when the application has none.

The rest of a row opens the application. The status badge opens a menu of the seven statuses. Choosing one updates that application immediately. If the open list is limited to one status and the new status does not match, the row leaves the list.

Search matches job title and company name. An applied-date range keeps applications whose applied date falls inside the range. Applications with no applied date stay in the list when no range is set, and drop out when a range is set. A status limit keeps only applications in that status.

The table loads one page at a time and offers next and previous when more results exist. Search, the applied-date range, the status limit, and the page stay in the list address, so opening an application and coming back shows the same list.

### Create and edit

Create and edit are separate screens. They use the same fields, including status. Saving a new application opens that application. Saving an edit returns to that application. Both screens link back to the dashboard.

### Application detail

One screen shows the application, then its interviews, then its notes.

The application block shows every saved field, and status is a label. The block links to the edit screen. Delete asks for confirmation first. After confirmation, the application, its interviews, and its notes are removed, and the previous list opens. A detail address opened on its own sends the person to the full application list after delete. The company stays, so it can be chosen on a later application.

From the interviews block, the person can add an interview, change its outcome, or delete it. No other interview field can be edited. Changing the date, type, round, or interviewer means deleting the interview and adding another. There is no separate interview screen.

From the notes block, the person can add a note, change its text, or delete it. There is no separate notes screen.

## Features

### Application fields

Required:

- Job title
- Company
- Location
- Status

Location is a city, Remote, or Hybrid, typed as text.

Status is one of Saved, Applied, Screening, Interview, Offer, Rejected, or Withdrawn. The create screen starts on Saved. The edit screen can change it. The application list can change it from the status badge.

Optional:

- Salary, as an amount or a range
- Job posting URL
- Date applied
- A short description written by the person

Company is a choice of companies this person already has, or a new name. A new name creates a company for this person only, when the application is saved. Two of this person's companies cannot share a name, even with different capitals. A name that matches an existing company in any case uses that company. The same name can exist for a different person. There is no company list screen and no company detail screen.

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

## Deployment

These screens are the product both locally and in production. Docker Compose runs the frontend, the API, and the database on one machine. In production, Amazon CloudFront is the public site. It serves the built frontend from S3 and forwards `/api` to the API. Technologies and the rest of the deploy path are in PROJECTSPEC.md and architecture.md, both in this folder.
