package com.ricoh360.thetaclient.capture

import com.ricoh360.thetaclient.ThetaApi
import com.ricoh360.thetaclient.ThetaRepository
import com.ricoh360.thetaclient.transferred.*
import io.ktor.client.plugins.*
import io.ktor.serialization.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val CHECK_STATE_INTERVAL = 1000L
private const val CHECK_STATE_RETRY = 3
private const val CHECK_SHOOTING_IDLE_COUNT = 2
private const val ERROR_GET_CAPTURE_STATUS = "Capture status cannot be retrieved."

/*
 * LimitlessIntervalCapture
 *
 * @property endpoint URL of Theta web API endpoint
 * @property cameraModel Camera model info.
 * @property options option of limitless interval capture
 */
class LimitlessIntervalCapture private constructor(private val endpoint: String, private val cameraModel: ThetaRepository.ThetaModel? = null, options: Options) :
    Capture(options) {

    private val scope = CoroutineScope(Dispatchers.Default)

    /**
     * Get shooting interval (sec.) for interval shooting.
     */
    fun getCaptureInterval() = options.captureInterval

    // TODO: Add get limitless interval option property

    /**
     * Callback of startCapture
     */
    interface StartCaptureCallback {

        /**
         * Called when stopCapture error occurs.
         *
         * @param exception Exception of error occurs
         */
        fun onStopFailed(exception: ThetaRepository.ThetaRepositoryException)

        /**
         * Called when error occurs.
         *
         * @param exception Exception of error occurs
         */
        fun onCaptureFailed(exception: ThetaRepository.ThetaRepositoryException)

        /**
         * Called when successful.
         *
         * @param fileUrls URLs of the limitless interval capture
         */
        fun onCaptureCompleted(fileUrls: List<String>?)
    }

    internal suspend fun getCaptureStatus(): CaptureStatus? {
        var retry = CHECK_STATE_RETRY
        while (retry > 0) {
            try {
                val stateResponse = ThetaApi.callStateApi(endpoint)
                return stateResponse.state._captureStatus
            } catch (e: Exception) {
                println("getCaptureStatus retry: $retry")
                delay(CHECK_STATE_INTERVAL)
            }
            retry -= 1
        }
        return null
    }

    /**
     * Starts limitless interval capture.
     *
     * @param callback Success or failure of the call
     */
    fun startCapture(callback: StartCaptureCallback): LimitlessIntervalCapturing {
        var isEndCapture = false

        fun callOnCaptureFailed(exception: ThetaRepository.ThetaRepositoryException) {
            if (isEndCapture) {
                return
            }
            isEndCapture = true
            callback.onCaptureFailed(exception)
        }

        fun callOnCaptureCompleted(fileUrls: List<String>?) {
            println("call callOnCaptureCompleted: $fileUrls")
            if (isEndCapture) {
                return
            }
            isEndCapture = true
            callback.onCaptureCompleted(fileUrls)
        }

        val captureCallback = object : StartCaptureCallback {
            override fun onStopFailed(exception: ThetaRepository.ThetaRepositoryException) {
                if (!isEndCapture) {
                    callback.onStopFailed(exception)
                }
            }

            override fun onCaptureFailed(exception: ThetaRepository.ThetaRepositoryException) {
            }

            override fun onCaptureCompleted(fileUrls: List<String>?) {
                callOnCaptureCompleted(fileUrls)
            }

        }
        scope.launch {
            try {
                val params = when (cameraModel) {
                    ThetaRepository.ThetaModel.THETA_X -> StartCaptureParams()
                    else -> StartCaptureParams(_mode = ShootingMode.INTERVAL_SHOOTING)
                }
                ThetaApi.callStartCaptureCommand(endpoint, params).error?.let {
                    callOnCaptureFailed(ThetaRepository.ThetaWebApiException(it.message))
                }
            } catch (e: JsonConvertException) {
                callOnCaptureFailed(ThetaRepository.ThetaWebApiException(e.message ?: e.toString()))
            } catch (e: ResponseException) {
                callOnCaptureFailed(ThetaRepository.ThetaWebApiException.create(e))
            } catch (e: Exception) {
                callOnCaptureFailed(
                    ThetaRepository.NotConnectedException(
                        e.message ?: e.toString()
                    )
                )
            }

            var idleCount = CHECK_SHOOTING_IDLE_COUNT
            while (!isEndCapture) {
                delay(CHECK_STATE_INTERVAL)
                when (getCaptureStatus()) {
                    null -> {
                        callOnCaptureFailed(
                            ThetaRepository.ThetaWebApiException(
                                ERROR_GET_CAPTURE_STATUS
                            )
                        )
                        break
                    }

                    CaptureStatus.IDLE -> {
                        idleCount -= 1
                        // In the case of SC2, it becomes idle in the middle, so wait multiple times
                        if (idleCount <= 0) {
                            break
                        }
                    }

                    else -> {
                        idleCount = CHECK_SHOOTING_IDLE_COUNT
                    }
                }
            }
            callOnCaptureCompleted(null)
        }
        return LimitlessIntervalCapturing(
            endpoint = endpoint,
            callback = captureCallback
        )
    }

    /*
     * Builder of LimitlessIntervalCapture
     *
     * @property endpoint URL of Theta web API endpoint
     * @property cameraModel Camera model info.
     */
    class Builder internal constructor(private val endpoint: String, val cameraModel: ThetaRepository.ThetaModel? = null) : Capture.Builder<Builder>() {

        /**
         * Builds an instance of a LimitlessIntervalCapture that has all the combined parameters of the Options that have been added to the Builder.
         *
         * @return LimitlessIntervalCapture
         */
        @Throws(Throwable::class)
        suspend fun build(): LimitlessIntervalCapture {
            try {
                ThetaApi.callSetOptionsCommand(
                    endpoint = endpoint,
                    params = SetOptionsParams(options = Options(captureMode = CaptureMode.IMAGE))
                ).error?.let {
                    throw ThetaRepository.ThetaWebApiException(message = it.message)
                }

                options.captureNumber = 0 // Unlimited (_limitless)
                when (cameraModel) {
                    ThetaRepository.ThetaModel.THETA_X -> options._shootingMethod = ShootingMethod.INTERVAL
                    else -> {}
                }
                ThetaApi.callSetOptionsCommand(endpoint = endpoint, params = SetOptionsParams(options)).error?.let {
                    throw ThetaRepository.ThetaWebApiException(message = it.message)
                }
            } catch (e: JsonConvertException) {
                throw ThetaRepository.ThetaWebApiException(message = e.message ?: e.toString())
            } catch (e: ResponseException) {
                throw ThetaRepository.ThetaWebApiException.create(exception = e)
            } catch (e: ThetaRepository.ThetaWebApiException) {
                throw e
            } catch (e: Exception) {
                throw ThetaRepository.NotConnectedException(message = e.message ?: e.toString())
            }
            return LimitlessIntervalCapture(endpoint = endpoint, cameraModel = cameraModel, options = options)
        }

        /**
         * Set shooting interval (sec.) for interval shooting.
         * @param interval sec
         * @return Builder
         */
        fun setCaptureInterval(interval: Int): Builder {
            options.captureInterval = interval
            return this
        }

        // TODO: Add set limitless interval option property
    }
}
