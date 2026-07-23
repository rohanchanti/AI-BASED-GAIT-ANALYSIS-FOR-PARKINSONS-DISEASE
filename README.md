# AI-Based Gait Analysis System for Parkinson's Disease

## Overview

The **AI-Based Gait Analysis System for Parkinson's Disease** is a Biomedical Engineering project that uses **Artificial Intelligence**, **Computer Vision**, and **Biomechanical Analysis** to assess human gait from walking videos. The system provides an accessible, markerless solution for analyzing gait characteristics that may be associated with Parkinson's disease, eliminating the need for expensive motion capture laboratories or wearable sensors.

Users simply upload a walking video through a modern web interface, and the system automatically extracts body landmarks, analyzes gait patterns, computes clinically relevant parameters, and presents the results in an interactive dashboard.

---

## Project Objective

The primary objective of this project is to develop an intelligent, software-based gait analysis platform capable of objectively evaluating walking patterns using computer vision techniques. The system aims to support clinicians, researchers, and students by providing quantitative gait measurements, AI-assisted clinical summaries, and visual analytics that can help identify gait abnormalities commonly associated with Parkinson's disease.

The project also demonstrates how modern AI technologies can improve accessibility to gait assessment by reducing dependence on specialized hardware and costly laboratory equipment.

---

## Website Features

The web application provides a simple and user-friendly workflow:

* Upload a walking video in common video formats.
* Select the desired gait analysis mode.
* Automatic AI processing in the background.
* Real-time progress updates during analysis.
* Interactive clinical dashboard displaying measured gait parameters.
* AI-generated clinical summary.
* Parkinson's risk estimation.
* Disease severity classification.
* Export reports in PDF, PNG, CSV, and JSON formats.
* Responsive interface with Dark and Light themes.

The user only interacts with the upload interface and final results, while all AI processing is performed automatically in the background.

---

## Gait Parameters Analyzed

The system measures multiple clinically relevant gait parameters, including:

* Walking Speed
* Cadence
* Step Length
* Stride Length
* Step Width
* Step Time
* Stride Time
* Gait Cycle Duration
* Stance Phase
* Swing Phase
* Double Support Time
* Single Support Time
* Arm Swing Symmetry
* Walking Symmetry Index
* Gait Stability Index
* Turning Time
* Timed Up and Go (TUG)
* Overall Gait Health Score
* Balance Score
* Fall Risk Score
* Parkinson's Risk Score
* Disease Severity Classification

---

## How It Works

1. The user uploads a walking video.
2. The system preprocesses the video frames.
3. AI-based pose estimation detects body landmarks.
4. Motion tracking extracts gait cycles and biomechanical features.
5. Gait parameters are calculated automatically.
6. The calculated values are compared with healthy reference ranges from published literature.
7. A Clinical Decision Support System generates an overall assessment.
8. Results are presented through an interactive dashboard with charts and downloadable reports.

---

## Technologies Used

### Backend

* Python
* Flask

### Artificial Intelligence

* MediaPipe Pose
* OpenCV
* NumPy
* SciPy
* Pandas

### Frontend

* HTML5
* CSS3
* JavaScript
* Bootstrap

### Visualization

* Chart.js
* Plotly

---

## Applications

This project can be used for:

* Parkinson's disease gait assessment
* Rehabilitation monitoring
* Biomedical Engineering education
* AI and Computer Vision research
* Clinical decision support
* Human movement analysis

---

Disclaimer

This project is developed for **research, educational, and demonstration purposes**. It is **not a certified medical device** and should not be used as the sole basis for medical diagnosis or treatment. Clinical decisions should always be made by qualified healthcare professionals.


Applying Artificial Intelligence and Computer Vision to create an accessible, software-based clinical gait analysis platform for Parkinson's disease assessment.
