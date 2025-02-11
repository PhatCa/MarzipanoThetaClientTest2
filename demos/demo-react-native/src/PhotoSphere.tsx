import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import ImageResizer from 'react-native-image-resizer';
import StaticServer from 'react-native-static-server';

const PhotoSphere = ({ route, navigation }) => {
  const imageUrl = route.params.item.fileUrl; 
  const webviewRef = useRef(null);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>360 Viewer</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/marzipano/0.10.2/marzipano.js"></script>
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
                        const geometry = new Marzipano.EquirectGeometry([{ width: 11008 }]);
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

  useEffect(() => {
    let server: StaticServer | null = null;

    // const setupServer = async () => {
    //   try {
    //     setLoading(true); // Set loading state for new image

    //     // Resize the image
    //     // const response = await ImageResizer.createResizedImage(imageUrl, 11008, 5504, 'JPEG', 100);
    //     // setCompressedImage(response.uri);

    //     // Stop any existing server before starting a new one
    //     if (server) {
    //       console.log('Stopping existing server...');
    //       await server.stop();
    //     }

    //     // Start a new static server
    //     const port = 8080 + Math.floor(Math.random() * 1000); // Use a random port to avoid conflicts
    //     server = new StaticServer(port, imageUrl);
    //     const url = await server.start();
    //     console.log('Static server started at:', url);
    //     setServerUrl(url);

    //     setLoading(false); // Set loading to false when server is ready
    //   } catch (error) {
    //     console.error('Error setting up server:', error);
    //     setLoading(false);
    //   }
    // };

    // setupServer();

    navigation.setOptions({ title: route.params.item.name });

    // Cleanup function to stop the server when the component is unmounted or updated
    return () => {
      if (imageUrl) {
        // console.log('Stopping server during cleanup...');
        // server.stop();
        setLoading(false);
      }
    };
  }, [imageUrl, navigation, route.params.item.name]);


  return (
    <>
      {imageUrl ? (
        <WebView
        //   key={serverUrl} // Use serverUrl to force WebView re-render
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1 }}
          injectedJavaScriptBeforeContentLoaded={`
            window.imageUrl = "${imageUrl}";
            true;
          `}
          onMessage={event => console.log('WebView log:', event.nativeEvent.data)}
          mixedContentMode="compatibility"
        />
      ) : (
        <ActivityIndicator size="large" color="#0000ff" />
      )}
    </>
  );
};

export default PhotoSphere;
