import React from 'react';
import {View, Image, Text} from 'react-native';
import styles from './Styles';
import { WebView } from 'react-native-webview';
import { useState, useEffect, useRef } from 'react';


const PhotoSphere = ({route, navigation}) => {
  const imageUrl = route.params.item.fileUrl;
    // const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/4/43/Cute_dog.jpg'; // this test run
  const webviewRef = useRef(null);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>360 Viewer</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/marzipano/0.10.2/marzipano.js" 
                integrity="sha512-ir2jZ6Hz/Cf+gtVoZGAeKluqMN8xD9IY1vl1/2zL+xGGJfi92roMegfbqoKyZXEc8NALMKP/j/uRRhKuUirVuA==" 
                crossorigin="anonymous" referrerpolicy="no-referrer"></script>
        <style>
            #viewer {
                width: 100%;
                height: 100vh;
                visibility: hidden;
            }
            #displayText {
                margin: 20px;
                text-align: center;
            }
            button {
                display: block;
                margin: 20px auto;
            }
        </style>
    </head>
    <body>
        <h1 id="displayText">Click the button to view the 360 image</h1>
        <button id="loadButton">Load 360 Image</button>
        <div id="viewer"></div>

        <script>
            window.ReactNativeWebView.postMessage("Script loaded");

            function logMessage(message) {
                window.ReactNativeWebView.postMessage(message);
            }

            window.loadImageUrl = function() {
                logMessage("Inside loadImageUrl function");

                if (typeof Marzipano === 'undefined') {
                    logMessage("Marzipano is not defined");
                    return;
                }

                if (window.imageUrl) {
                    logMessage("imageUrl found: " + window.imageUrl);

                    document.getElementById("displayText").style.display = 'none';
                    document.getElementById("viewer").style.visibility = 'visible';

                    try {
                        const viewer = new Marzipano.Viewer(document.getElementById('viewer'));
                        const source = Marzipano.ImageUrlSource.fromString(window.imageUrl);
                        const geometry = new Marzipano.EquirectGeometry([{ width: 4000 }]);
                        const limiter = Marzipano.RectilinearView.limit.traditional(4096, 90 * Math.PI / 180);
                        const view = new Marzipano.RectilinearView(null, limiter);

                        const scene = viewer.createScene({
                            source: source,
                            geometry: geometry,
                            view: view,
                            pinFirstLevel: true
                        });

                        scene.switchTo();
                        logMessage("Scene switched successfully");
                    } catch (error) {
                        logMessage("Error in Marzipano setup: " + error.message);
                    }
                } else {
                    logMessage("No image URL received.");
                    document.getElementById("displayText").innerText = "No image URL received.";
                }
            };

            window.addEventListener("load", function() {
                const button = document.getElementById("loadButton");
                if (button) {
                    button.addEventListener("click", function() {
                        logMessage("Button clicked");
                        window.loadImageUrl();
                    });
                }
            });
        </script>
    </body>
    </html>
    `;

    const injectedJavaScriptBeforeContentLoaded = `
    window.imageUrl = "${imageUrl}";
    true;
`;

  React.useEffect(() => {
    navigation.setOptions({title: route.params.item.name});
  }, [navigation, route.params.item.name]);

  return (
    <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html }}
            style={{ flex: 1 }}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            onMessage={(event) => console.log("WebView log:", event.nativeEvent.data)}
            mixedContentMode="compatibility"
        />
  );
};

export default PhotoSphere;
