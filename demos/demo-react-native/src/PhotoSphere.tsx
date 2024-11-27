import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import ImageResizer from 'react-native-image-resizer';
import StaticServer from 'react-native-static-server';

const PhotoSphere = ({ route, navigation }) => {
    const imageUrl = route.params.item.fileUrl
//   const imageUrl = 'https://fake-theta.vercel.app/files/150100525831424d42075b53ce68c300/100RICOH/R0010015.JPG'; // this test run
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
    window.imageUrl = "${serverUrl}";
    true;
  `;

  useEffect(() => {
    let server: StaticServer | null = null; // Declare server variable in a shared scope

    ImageResizer.createResizedImage(imageUrl, 4000, 2000, 'JPEG', 100)
      .then(response => {
        setLoading(true);
        setCompressedImage(response.uri);

        // Start a static server
        server = new StaticServer(8080, Platform.OS === 'ios' ? response.uri.replace('file://', '') : response.uri);
        server.start().then(url => {
          setServerUrl(url);
          setLoading(false);
        });
      })
      .catch(error => {
        console.error('Error resizing image:', error);
        setLoading(false);
      });

      navigation.setOptions({ title: route.params.item.name });


    // Cleanup: stop the server if it was started
    return () => {
      if (server) {
        server.stop();
      }
    };
  }, [navigation, route.params.item.name, route.params.item.fileUrl]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <>
      {serverUrl ? (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1 }}
          injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
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
