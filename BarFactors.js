<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Disease Risk Factors Visualization</title>

    <!-- D3 library for drawing the bar chart -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>

    <style>
        /* Reset default margins and padding */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --header-height: 80px;
            --footer-height: 80px;
        }

        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }

        /* Header stays at the top */
        .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: var(--header-height);
            background-color: Lavender;
            color: black;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .title {
            flex: 1;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
        }

        .header a {
            color: black;
            text-decoration: none;
            font-weight: bold;
        }

        /* Footer stays at the bottom */
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: var(--footer-height);
            background-color: Lavender;
            color: black;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 100;
            box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
        }

        .footer_date {
            font-size: 12px;
            text-align: right;
        }

        .footer_date p {
            margin: 2px 0;
        }

        /* Main scrollable body - takes up all remaining space */
        .body {
            position: fixed;
            top: var(--header-height);
            left: 0;
            right: 0;
            bottom: var(--footer-height);
            width: 100%;
            overflow: auto;
            display: flex;
            gap: 20px;
            padding: 20px;
            background-color: #fafafa;
        }

        /* Left side - chart container */
        #chart-wrapper {
            flex: 1;
            min-width: 600px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        #loading-message {
            text-align: center;
            font-size: 16px;
            color: #666;
            padding: 20px;
        }

        /* Chart container - allow it to expand */
        #barchart-container {
            flex: 1;
            min-height: 400px;
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        /* Right side - diseases panel */
        #diseases-panel {
            flex: 0 0 350px;
            background-color: white;
            border: 2px solid #FF69B4;
            border-radius: 8px;
            padding: 20px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        #diseases-panel.active {
            display: block;
        }

        .diseases-title {
            font-size: 18px;
            font-weight: bold;
            color: #FF69B4;
            margin-bottom: 15px;
            border-bottom: 2px solid #FF69B4;
            padding-bottom: 10px;
        }

        .diseases-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .disease-item {
            background-color: #f9f9f9;
            padding: 12px;
            margin-bottom: 8px;
            border-left: 4px solid #FF69B4;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.4;
        }

        /* Bar styling */
        .bar {
            transition: opacity 0.3s, fill 0.3s;
            cursor: pointer;
        }

        .bar:hover {
            opacity: 0.8;
            filter: brightness(1.1);
        }

        .bar.active {
            fill: #FF1493 !important;
            filter: drop-shadow(0 0 4px rgba(255, 20, 147, 0.5));
        }

        /* Axis styling */
        .axis text {
            fill: #000000;
            font-size: 12px;
        }

        .axis line, .axis path {
            stroke: #ccc;
        }

        /* Scrollbar styling */
        .body::-webkit-scrollbar {
            width: 8px;
        }

        .body::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        .body::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }

        .body::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        @media (max-width: 1200px) {
            .body {
                flex-direction: column;
            }

            #diseases-panel {
                flex: 0 0 auto;
                min-height: 250px;
                max-height: 300px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div><a href="BarCharts.html">← Back</a></div>
        <h1 class="title">Diseases per Risk Factor</h1>
        <div style="width: 60px;"></div>
    </div>

    <!-- Main content area -->
    <div class="body">
        <!-- Left: Chart section -->
        <div id="chart-wrapper">
            <div id="loading-message">Loading data...</div>
            <div id="barchart-container"></div>
        </div>

        <!-- Right: Diseases panel -->
        <div id="diseases-panel" aria-hidden="true">
            <div class="diseases-title" id="selected-factor"></div>
            <ul class="diseases-list" id="diseases-list"></ul>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <img src="um_logo.png" alt="Logo of Maastricht University" width="44.92" height="50.28">
        <div class="title"><a href="AboutUs.html">About Us</a></div>
        <small class="footer_date">
            <p>created: 31/10/2025</p>
            <p>last updated: 07/11/2025</p>
        </small>
    </div>

    <script src="BarFactors.js"></script>
</body>
</html>
